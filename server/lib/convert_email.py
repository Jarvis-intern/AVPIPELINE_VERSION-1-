import os, sys, json, argparse, html, traceback, logging

# Add this at the top of the file for better debugging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    stream=sys.stderr)

# Explicitly check for required packages and give better error messages
try:
    import extract_msg
except ImportError:
    print(json.dumps({
        "converted_files": [],
        "failed_files": [sys.argv[4] if len(sys.argv) > 4 else "unknown"],
        "error": "Python package 'extract-msg' is not installed. Install with: pip install extract-msg",
        "traceback": traceback.format_exc()
    }))
    sys.exit(1)

# Try both versions of pypff package
pypff = None
try:
    import pypff
except ImportError:
    try:
        import libpff as pypff
    except ImportError:
        print(json.dumps({
            "converted_files": [],
            "failed_files": [sys.argv[4] if len(sys.argv) > 4 else "unknown"],
            "error": "Neither 'pypff' nor 'libpff' packages are installed. Install with: pip install pypff libpff-python",
            "traceback": traceback.format_exc()
        }))
        sys.exit(1)

import email, mailbox

def sanitize(name: str) -> str:
    keep = "-_.() "
    return "".join(c for c in name if c.isalnum() or c in keep).strip() or "message"

def ensure_dir(path: str):
    os.makedirs(path, exist_ok=True)

def write_html(out_dir: str, base: str, title: str, body_html: str) -> str:
    ensure_dir(out_dir)
    out_file = os.path.join(out_dir, f"{sanitize(base)}.html")
    html_doc = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>{html.escape(title)}</title></head>
<body>{body_html}</body></html>"""
    with open(out_file, "w", encoding="utf-8", errors="ignore") as f:
        f.write(html_doc)
    return out_file

def _to_str(v) -> str:
    # Normalize bytes/None to str
    if v is None:
        return ""
    if isinstance(v, bytes):
        try:
            return v.decode("utf-8", errors="ignore")
        except Exception:
            return v.decode("latin-1", errors="ignore")
    return str(v)

def _first_nonempty(*vals) -> str:
    for v in vals:
        s = _to_str(v).strip()
        if s:
            return s
    return ""

def convert_msg(input_path: str, output_dir: str):
    if extract_msg is None:
        return {"converted_files": [], "failed_files": [input_path],
                "error": "Python package 'extract-msg' is not installed. Install with: pip install -r server/lib/requirements.txt"}
    try:
        msg = extract_msg.Message(input_path)
        subject = _first_nonempty(getattr(msg, "subject", None),
                                  os.path.splitext(os.path.basename(input_path))[0],
                                  "message")
        html_body = getattr(msg, "htmlBody", None)
        txt_body = getattr(msg, "body", None)

        body_html = _to_str(html_body).strip()
        if not body_html:
            body_html = f"<pre>{html.escape(_to_str(txt_body))}</pre>"

        out = write_html(output_dir, subject, subject, body_html)
        return {"converted_files": [out], "failed_files": []}
    except Exception as e:
        return {"converted_files": [], "failed_files": [input_path], "error": str(e), "traceback": traceback.format_exc()}

def convert_pst(input_path: str, output_dir: str):
    if pypff is None:
        return {
            "converted_files": [],
            "failed_files": [input_path],
            "error": "PST conversion requires libpff bindings. Install 'libpff-python' or 'pypff'."
        }
    # Helpers
    def format_size(sz: int) -> str:
        units = ["B", "KB", "MB", "GB", "TB"]
        v = float(sz)
        for u in units:
            if v < 1024:
                return f"{v:.1f} {u}"
            v /= 1024.0
        return f"{v:.1f} PB"

    def get_unique(dirpath: str, fname: str) -> str:
        base, ext = os.path.splitext(fname)
        candidate = fname
        i = 1
        while os.path.exists(os.path.join(dirpath, candidate)):
            candidate = f"{base}_{i}{ext}"
            i += 1
        return candidate

    converted_files = []
    failed_files = []
    try:
        pff_cls = getattr(pypff, "file", None) or getattr(pypff, "File", None)
        if pff_cls is None:
            return {"converted_files": [], "failed_files": [input_path], "error": "libpff bindings do not expose file/File"}

        pst = pff_cls()
        pst.open(input_path)
        try:
            root = pst.get_root_folder()
        except Exception:
            pst.close()
            raise

        base_name = os.path.splitext(os.path.basename(input_path))[0]
        html_root = os.path.join(output_dir, sanitize(base_name))
        ensure_dir(html_root)
        email_idx = 0

        def walk_folder(folder):
            nonlocal email_idx
            try:
                n_msgs = getattr(folder, "number_of_sub_messages", None)
                n_msgs = n_msgs if isinstance(n_msgs, int) else getattr(folder, "get_number_of_sub_messages", lambda: 0)()
            except Exception:
                n_msgs = 0

            for i in range(n_msgs):
                try:
                    msg = folder.get_sub_message(i)
                except Exception:
                    continue
                email_idx += 1

                subject = _first_nonempty(getattr(msg, "subject", None), f"email_{email_idx}")
                sender = _first_nonempty(getattr(msg, "sender_name", None), getattr(msg, "sender_email_address", None), "Unknown")
                to = _to_str(getattr(msg, "display_to", None))
                cc = _to_str(getattr(msg, "display_cc", None))
                date = _to_str(getattr(msg, "client_submit_time", None) or "Unknown Date")

                # Bodies may be bytes; decode safely
                html_body_raw = getattr(msg, "html_body", None)
                text_body_raw = getattr(msg, "plain_text_body", None)
                body_html = _to_str(html_body_raw).strip()
                body_text = _to_str(text_body_raw)

                body = body_html if body_html else f"<pre>{html.escape(body_text)}</pre>"

                msg_base = f"email_{email_idx}"
                attach_dir = os.path.join(html_root, f"{msg_base}_attachments")
                ensure_dir(attach_dir)
                links = []

                try:
                    n_att = getattr(msg, "number_of_attachments", None)
                    n_att = n_att if isinstance(n_att, int) else getattr(msg, "get_number_of_attachments", lambda: 0)()
                except Exception:
                    n_att = 0

                for j in range(n_att):
                    try:
                        att = msg.get_attachment(j)
                    except Exception:
                        continue
                    name = _first_nonempty(getattr(att, "long_filename", None),
                                           getattr(att, "filename", None),
                                           f"attachment_{j}")
                    name = get_unique(attach_dir, sanitize(name))
                    outp = os.path.join(attach_dir, name)
                    try:
                        data = None
                        rb = getattr(att, "read_buffer", None)
                        if callable(rb):
                            data = rb()
                        elif isinstance(rb, (bytes, bytearray)):
                            data = rb
                        # Some bindings expose get_size()+read() loop; fallback if needed
                        if not data and hasattr(att, "get_size") and hasattr(att, "read"):
                            try:
                                size = att.get_size()
                                data = att.read(size)
                            except Exception:
                                data = None
                        if data:
                            with open(outp, "wb") as f:
                                f.write(data)
                            size = os.path.getsize(outp)
                            rel = os.path.relpath(outp, html_root)
                            links.append(f'<a target="_blank" href="{rel}" class="attachment-link">📎 {html.escape(name)} ({format_size(size)})</a>')
                    except Exception:
                        continue

                html_body_full = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>{html.escape(subject)}</title>
<style>
body {{ font-family:sans-serif; margin:20px; line-height:1.6; }}
.header {{ background:#f5f5f5; padding:12px; border-left:4px solid #dc3545; margin-bottom:16px; }}
.attachments {{ background:#f9f9f9; padding:12px; border-left:4px solid #28a745; margin-top:16px; }}
.attachment-link {{ display:inline-block; margin:4px 8px 4px 0; padding:4px 8px; background:#e9ecef; border-radius:3px; text-decoration:none; color:#495057; }}
.attachment-link:hover {{ background:#dee2e6; }}
pre {{ white-space: pre-wrap; word-wrap: break-word; }}
</style></head><body>
<div class="header">
  <h2>{html.escape(subject)}</h2>
  <div><strong>From:</strong> {html.escape(sender)}</div>
  <div><strong>To:</strong> {html.escape(to)}</div>
  <div><strong>Cc:</strong> {html.escape(cc)}</div>
  <div><strong>Date:</strong> {html.escape(date)}</div>
</div>
{body}
{('<div class="attachments"><h3>📎 Attachments</h3>' + ''.join(links) + '</div>') if links else ''}
</body></html>"""
                out_file = os.path.join(html_root, f"{msg_base}.html")
                with open(out_file, "w", encoding="utf-8", errors="ignore") as f:
                    f.write(html_body_full)
                converted_files.append(out_file)

            try:
                n_sub = getattr(folder, "number_of_sub_folders", None)
                n_sub = n_sub if isinstance(n_sub, int) else getattr(folder, "get_number_of_sub_folders", lambda: 0)()
            except Exception:
                n_sub = 0
            for k in range(n_sub):
                try:
                    sub = folder.get_sub_folder(k)
                except Exception:
                    continue
                walk_folder(sub)

        walk_folder(root)
        pst.close()
        return {"converted_files": converted_files, "failed_files": failed_files}
    except Exception as e:
        return {"converted_files": converted_files, "failed_files": [input_path], "error": str(e), "traceback": traceback.format_exc()}

def convert_eml(input_path: str, output_dir: str):
    try:
        with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
            msg = email.message_from_file(f)
        subject = msg.get("Subject", "message")
        sender = msg.get("From", "Unknown")
        to = msg.get("To", "")
        cc = msg.get("Cc", "")
        date = msg.get("Date", "Unknown Date")
        body_html = None
        body_text = ""
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                body_html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
            elif part.get_content_type() == "text/plain":
                body_text = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
        body = body_html if body_html else f"<pre>{html.escape(body_text)}</pre>"
        out = write_html(output_dir, subject, subject, body)
        return {"converted_files": [out], "failed_files": []}
    except Exception as e:
        return {"converted_files": [], "failed_files": [input_path], "error": str(e), "traceback": traceback.format_exc()}

def convert_mbox(input_path: str, output_dir: str):
    converted_files = []
    failed_files = []
    try:
        mbox = mailbox.mbox(input_path)
        for idx, msg in enumerate(mbox):
            subject = msg.get("Subject", f"message_{idx}")
            sender = msg.get("From", "Unknown")
            to = msg.get("To", "")
            cc = msg.get("Cc", "")
            date = msg.get("Date", "Unknown Date")
            body_html = None
            body_text = ""
            for part in msg.walk():
                if part.get_content_type() == "text/html":
                    body_html = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
                elif part.get_content_type() == "text/plain":
                    body_text = part.get_payload(decode=True).decode(part.get_content_charset() or "utf-8", errors="ignore")
            body = body_html if body_html else f"<pre>{html.escape(body_text)}</pre>"
            out = write_html(output_dir, subject, subject, body)
            converted_files.append(out)
        return {"converted_files": converted_files, "failed_files": failed_files}
    except Exception as e:
        return {"converted_files": converted_files, "failed_files": [input_path], "error": str(e), "traceback": traceback.format_exc()}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--type", choices=["msg","pst","mbox","eml"], required=True)
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    if args.type == "msg":
        res = convert_msg(args.input, args.output)
    elif args.type == "pst":
        res = convert_pst(args.input, args.output)
    elif args.type == "eml":
        res = convert_eml(args.input, args.output)
    elif args.type == "mbox":
        res = convert_mbox(args.input, args.output)

    # Always JSON to stdout
    print(json.dumps({
        "converted_files": res.get("converted_files", []),
        "failed_files": res.get("failed_files", []),
        "error": res.get("error", ""),
        "traceback": res.get("traceback", ""),
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
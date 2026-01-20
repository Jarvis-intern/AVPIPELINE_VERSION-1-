# AV Pipeline Test Sample Data

This folder contains comprehensive sample files for testing the AV Pipeline functionality.

## 📁 Directory Structure

```
sample data/
├── README.md                              # This file
│
├── 01_email_samples/                      # Email Conversion Tests
│   ├── simple_email.eml                   # Plain text email (345B)
│   ├── html_email.eml                     # HTML formatted newsletter (2.2KB)
│   ├── email_with_attachment.eml          # Email with 2 attachments (1.4KB)
│   ├── mailbox.mbox                       # MBOX with 4 emails (2KB)
│   ├── comprehensive_mailbox.mbox         # MBOX with 5 rich emails (7.1KB)
│   ├── sample_outlook.msg                 # ★ REAL Outlook MSG file (2MB)
│   ├── business_report.msg                # Business report email (2.6KB)
│   ├── meeting_invite.msg                 # Calendar invite email (2.2KB)
│   ├── invoice_notification.msg           # Invoice email (3.4KB)
│   ├── minimal_test.pst                   # ★ PST file structure (512B)
│   └── test_email_archive.pst             # Archive test file (548B)
│
├── 02_virus_samples/                      # Virus Scanning Tests (EICAR)
│   ├── eicar.txt                          # Standard EICAR test file (69B)
│   ├── eicar.com                          # EICAR as .com file (69B)
│   └── eicar_in_archive.zip               # EICAR inside zip (247B)
│
├── 03_archive_samples/                    # Archive Extraction Tests
│   ├── simple.zip                         # Simple unprotected zip (1.2KB)
│   ├── documents.tar.gz                   # Tar.gz archive (439B)
│   └── mixed_content.7z                   # Archive with mixed files (1KB)
│
├── 04_password_protected/                 # Password-Protected Archives
│   ├── password_protected.zip             # Password: "test123"
│   ├── nested_password/
│   │   └── outer.zip                      # Password: "outer123"
│   │       └── (contains inner.zip)       # Password: "inner456"
│   └── triple_nested/
│       └── triple_protected.zip           # 3 levels of passwords!
│
└── 05_nested_archives/                    # Deep Nesting Tests
    ├── level1.zip                         # 3 levels deep
    └── complex_nested.zip                 # Mixed with password
```

---

## 📧 Email Sample Details

### EML Files (RFC 822 Standard)
| File | Size | Content |
|------|------|---------|
| `simple_email.eml` | 345B | Plain text email |
| `html_email.eml` | 2.2KB | Rich HTML newsletter with CSS |
| `email_with_attachment.eml` | 1.4KB | Email with TXT and JSON attachments |

### MBOX Files (Unix Mailbox)
| File | Size | Emails | Content |
|------|------|--------|---------|
| `mailbox.mbox` | 2KB | 4 | Mixed plain/HTML emails |
| `comprehensive_mailbox.mbox` | 7.1KB | 5 | Rich HTML emails (newsletter, security alert, etc.) |

### MSG Files (Microsoft Outlook)
| File | Size | Type | Description |
|------|------|------|-------------|
| `sample_outlook.msg` | 2MB | ★ **Real CDFV2** | Actual Outlook MSG file |
| `business_report.msg` | 2.6KB | EML format | Q4 Financial Report with table |
| `meeting_invite.msg` | 2.2KB | EML format | Calendar invite with buttons |
| `invoice_notification.msg` | 3.4KB | EML format | Detailed invoice with line items |

### PST Files (Outlook Personal Storage)
| File | Size | Type | Description |
|------|------|------|-------------|
| `minimal_test.pst` | 512B | ★ **Valid PST header** | Minimal PST structure |
| `test_email_archive.pst` | 548B | Text format | Test archive format |

**★** = Properly formatted binary files that should be recognized by the converter

---

## 🔐 Password Reference

| Archive | Password | Notes |
|---------|----------|-------|
| `password_protected.zip` | `test123` | Single file test |
| `outer.zip` | `outer123` | Contains inner.zip |
| `inner.zip` | `inner456` | Inside outer.zip |
| `triple_protected.zip` | `level1pass` | First of 3 levels |
| `level2_protected.zip` | `level2pass` | Inside triple_protected |
| `level3_protected.zip` | `level3pass` | Deepest level |
| `secret_docs.zip` | `secret789` | Inside complex_nested.zip |

---

## ⚠️ EICAR Test Virus

The files in `02_virus_samples/` use the **EICAR test string** - a harmless file recognized by all antivirus software as a "virus" for testing.

```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

**This is NOT a real virus** - it's an industry-standard test file.

---

## 🧪 Testing Guide

### 1. Email Conversion Test
**Upload from:** `01_email_samples/`

| Test | File | Expected Result |
|------|------|-----------------|
| Plain text | `simple_email.eml` | Converts to HTML |
| Rich HTML | `html_email.eml` | Preserves HTML formatting |
| Attachments | `email_with_attachment.eml` | Extracts TXT + JSON files |
| Multi-email | `mailbox.mbox` | Creates 4 HTML files |
| Multi-email | `comprehensive_mailbox.mbox` | Creates 5 HTML files |
| Outlook MSG | `sample_outlook.msg` | Converts real MSG to HTML |
| PST Archive | `minimal_test.pst` | Attempts PST parsing |

### 2. Virus Scan Test
**Upload from:** `02_virus_samples/`

| File | Expected Detection |
|------|-------------------|
| `eicar.txt` | EICAR-Standard-Antivirus-Test-File |
| `eicar.com` | EICAR-Test (executable) |
| `eicar_in_archive.zip` | EICAR inside archive |

### 3. Archive Extraction Test
**Upload from:** `03_archive_samples/`

| Archive | Contains |
|---------|----------|
| `simple.zip` | 5 files (txt, json, md) |
| `documents.tar.gz` | txt, csv in subdirectory |
| `mixed_content.7z` | js, css, log files |

### 4. Password-Protected Test
**Upload from:** `04_password_protected/`

| Step | Archive | Password |
|------|---------|----------|
| 1 | `password_protected.zip` | `test123` |
| 2 | `outer.zip` | `outer123` |
| 3 | `inner.zip` (after outer) | `inner456` |

### 5. Nested Archive Test
**Upload from:** `05_nested_archives/`

| Archive | Nesting |
|---------|---------|
| `level1.zip` | level1 → level2 → level3 → files |
| `complex_nested.zip` | regular files + `secret_docs.zip` (pw: secret789) |

---

## 🚀 Quick Test Command

Upload the entire `sample data` folder to test all functionality at once!

**Recommended order:**
1. ✅ `03_archive_samples/` - Simple extraction
2. ✅ `01_email_samples/` - Email conversion (try MSG first!)  
3. ✅ `02_virus_samples/` - Virus detection
4. ✅ `05_nested_archives/level1.zip` - Recursive extraction
5. ✅ `04_password_protected/` - Password handling

---

## 📝 Notes

- **MSG files**: `sample_outlook.msg` is a **real** Microsoft Outlook file
- **PST files**: `minimal_test.pst` has valid PST header structure
- **For full PST testing**: Export from Microsoft Outlook
- Helper scripts: See `create_email_samples.py` and `create_pst_samples.py`

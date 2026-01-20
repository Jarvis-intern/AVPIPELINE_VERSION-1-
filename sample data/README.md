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
│   ├── business_report.eml                # Business report email (2.6KB)
│   ├── meeting_invite.eml                 # Calendar invite email (2.2KB)
│   ├── invoice_notification.eml           # Invoice email (3.4KB)
│   ├── mailbox.mbox                       # MBOX with 4 emails (2KB)
│   ├── comprehensive_mailbox.mbox         # MBOX with 5 rich emails (7.1KB)
│   └── sample_outlook.msg                 # ★ REAL Outlook MSG file (2MB)
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
| File | Content |
|------|---------|
| `simple_email.eml` | Plain text email |
| `html_email.eml` | Rich HTML newsletter |
| `email_with_attachment.eml` | With attachments |
| `business_report.eml` | Financial report table |
| `meeting_invite.eml` | Calendar invite |
| `invoice_notification.eml` | Invoice with details |

### MBOX Files (Unix Mailbox)
| File | Emails | Content |
|------|--------|---------|
| `mailbox.mbox` | 4 | Mixed plain/HTML emails |
| `comprehensive_mailbox.mbox` | 5 | Rich HTML emails |

### MSG Files (Microsoft Outlook)
| File | Type | Description |
|------|------|-------------|
| `sample_outlook.msg` | **Real CDFV2** | Actual Outlook MSG file |

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

## 🧪 Testing Guide

### 1. Email Conversion Test
**Upload from:** `01_email_samples/`

**Expected Result:** All 9 files should handle conversion:
- 8 EML/MBOX files will convert to HTML
- 1 MSG file will convert to HTML (via Python script)

### 2. Virus Scan Test
**Upload from:** `02_virus_samples/`

**Expected Result:** All 3 EICAR files detected as threats.

### 3. Archive Extraction Test
**Upload from:** `03_archive_samples/`

**Expected Result:** All archives extracted.

### 4. Password-Protected Test
**Upload from:** `04_password_protected/`

**Expected Result:** System prompts for passwords.

---

## 📝 Troubleshooting

- **MSG/PST conversion**: Requires Python libraries `extract-msg` and `libpff-python` installed on the server.
- **"Fake" MSG files**: Ensure you use `sample_outlook.msg` for true MSG testing. Other files are EMLs renamed for convenience in standard tests.

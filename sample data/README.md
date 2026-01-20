# AV Pipeline Test Sample Data

This folder contains sample files for testing the AV Pipeline functionality.

## 📁 Directory Structure

```
sample data/
├── README.md                              # This file
│
├── 01_email_samples/                      # Email conversion tests
│   ├── simple_email.eml                   # Plain text email
│   ├── html_email.eml                     # HTML formatted newsletter
│   ├── email_with_attachment.eml          # Email with 2 attachments
│   └── mailbox.mbox                       # MBOX with 4 emails
│
├── 02_virus_samples/                      # Virus scanning tests (EICAR)
│   ├── eicar.txt                          # Standard EICAR test file
│   ├── eicar.com                          # EICAR as .com file
│   └── eicar_in_archive.zip               # EICAR inside zip archive
│
├── 03_archive_samples/                    # Archive extraction tests
│   ├── simple.zip                         # Simple unprotected zip
│   ├── documents.tar.gz                   # Tar.gz archive
│   └── mixed_content.7z                   # Archive with mixed files
│
├── 04_password_protected/                 # Password-protected archives
│   ├── password_protected.zip             # Password: "test123"
│   └── nested_password/
│       └── outer.zip                      # Password: "outer123"
│           └── (contains inner.zip)       # Password: "inner456"
│
└── 05_nested_archives/                    # Deep nesting tests
    ├── level1.zip                         # Contains level2.zip
    │   └── level2.zip                     # Contains level3.zip
    │       └── level3.zip                 # Contains final files
    └── complex_nested.zip                 # Mixed nesting
        └── (contains secret_docs.zip)     # Password: "secret789"
```

## 🔐 Password Reference

| Archive | Password | Location |
|---------|----------|----------|
| `password_protected.zip` | `test123` | 04_password_protected/ |
| `outer.zip` | `outer123` | 04_password_protected/nested_password/ |
| `inner.zip` | `inner456` | Inside outer.zip |
| `secret_docs.zip` | `secret789` | Inside complex_nested.zip |

## ⚠️ EICAR Test Virus

The files in `02_virus_samples/` use the **EICAR test string** - a harmless test file 
recognized by all antivirus software as a "virus" for testing purposes.

**EICAR Test String (68 bytes):**
```
X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*
```

⚠️ **This is NOT a real virus** - it's an industry-standard test file created by the 
European Institute for Computer Antivirus Research (EICAR).

Learn more: https://www.eicar.org/download-anti-malware-testfile/

## 🧪 Testing Guide

### 1. Email Conversion Test
**Files:** `01_email_samples/`
- `simple_email.eml` - Basic plain text email
- `html_email.eml` - Rich HTML newsletter with styling
- `email_with_attachment.eml` - Email with text and JSON attachments
- `mailbox.mbox` - Contains 4 different emails

**Expected Result:** All emails converted to HTML with attachments extracted

---

### 2. Virus Scan Test  
**Files:** `02_virus_samples/`
- `eicar.txt` - Standard test file
- `eicar.com` - Simulates executable
- `eicar_in_archive.zip` - Tests scanning inside archives

**Expected Result:** All EICAR files detected as threats

---

### 3. Archive Extraction Test
**Files:** `03_archive_samples/`
- `simple.zip` - 5 files including markdown and JSON
- `documents.tar.gz` - Linux-style compressed archive
- `mixed_content.7z` - Various file types

**Expected Result:** All archives extracted successfully

---

### 4. Password-Protected Test
**Files:** `04_password_protected/`

| Step | Archive | Password |
|------|---------|----------|
| 1 | `password_protected.zip` | `test123` |
| 2 | `outer.zip` | `outer123` |
| 3 | `inner.zip` (inside outer) | `inner456` |

**Expected Result:** System prompts for passwords, extracts after correct password entered

---

### 5. Nested Archive Test
**Files:** `05_nested_archives/`
- `level1.zip` → `level2.zip` → `level3.zip` → final files
- `complex_nested.zip` → regular files + `secret_docs.zip` (password: `secret789`)

**Expected Result:** All nested levels extracted recursively

---

## 📝 File Details

### Email Samples
| File | Size | Description |
|------|------|-------------|
| simple_email.eml | ~300B | Plain text email |
| html_email.eml | ~2KB | Rich HTML with CSS styling |
| email_with_attachment.eml | ~1.5KB | 2 base64 attachments |
| mailbox.mbox | ~2KB | 4 emails (mixed plain/HTML) |

### Virus Samples
| File | Size | Detection |
|------|------|-----------|
| eicar.txt | 68B | EICAR-Test-File |
| eicar.com | 68B | EICAR-Test-File |
| eicar_in_archive.zip | ~200B | Archive containing EICAR |

### Archive Samples
| File | Contents |
|------|----------|
| simple.zip | txt, json, md files |
| documents.tar.gz | txt, csv files |
| mixed_content.7z | js, css, log, txt files |

---

## 🚀 Quick Test

Upload the entire `sample data` folder to test all functionality at once, or test 
individual folders for specific features.

**Recommended test order:**
1. ✅ Start with `03_archive_samples/` (simple extraction)
2. ✅ Then `01_email_samples/` (email conversion)
3. ✅ Then `02_virus_samples/` (virus detection)
4. ✅ Then `05_nested_archives/level1.zip` (recursive extraction)
5. ✅ Finally `04_password_protected/` (password handling)

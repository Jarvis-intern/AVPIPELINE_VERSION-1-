EMAIL SAMPLES FOR AV PIPELINE TESTING
=====================================

FILES INCLUDED:
---------------

EML Files (RFC 822 Standard Email Format):
  - simple_email.eml         : Plain text email
  - html_email.eml           : HTML formatted email
  - email_with_attachment.eml: Email with base64 attachments

MBOX Files (Unix Mailbox Format):
  - mailbox.mbox             : 4 emails (plain + HTML)
  - comprehensive_mailbox.mbox: 5 emails with rich HTML

MSG Files (Microsoft Outlook):
  - sample_outlook.msg       : REAL Outlook MSG file (2MB, CDFV2 format)
  - business_report.msg      : EML-format test file with .msg extension
  - meeting_invite.msg       : EML-format test file with .msg extension  
  - invoice_notification.msg : EML-format test file with .msg extension

NOTES ABOUT PST FILES:
---------------------
PST (Personal Storage Table) files are proprietary Microsoft Outlook files.
Creating valid PST files requires:
  1. Microsoft Outlook application
  2. Commercial PST creation libraries
  3. Specialized tools like PST creation SDKs

For PST testing:
  - Export a PST from Outlook manually
  - Or use the MSG file which IS a valid Outlook format

The sample_outlook.msg file IS a real Microsoft Outlook Message file
and should be recognized correctly by the conversion tools.

FORMAT DETAILS:
--------------
- EML: Plain text, RFC 822 compliant
- MBOX: Multiple emails in single file, separated by "From " lines
- MSG: OLE Compound Document (CDFV2), Microsoft proprietary
- PST: Personal Storage Table, Microsoft Outlook database format

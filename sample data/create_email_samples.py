#!/usr/bin/env python3
"""
Script to create sample MSG, MBOX, and PST-like files for testing AV Pipeline.
MSG files are OLE compound documents used by Microsoft Outlook.
"""

import os
import struct
import datetime

# Output directory
OUTPUT_DIR = "/home/petals/work/avpipelinefinish/sample data/01_email_samples"

def create_mbox_comprehensive():
    """Create a more comprehensive MBOX file with various email types."""
    mbox_content = '''From user1@example.com Mon Jan 20 09:00:00 2026
From: John Doe <john.doe@example.com>
To: Jane Smith <jane.smith@example.com>
Subject: Q1 2026 Project Meeting Schedule
Date: Mon, 20 Jan 2026 09:00:00 +0530
Message-ID: <20260120090000.ABC123@example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"

Hi Jane,

I wanted to share the meeting schedule for Q1 2026:

- Weekly standup: Every Monday at 10 AM
- Sprint planning: First Monday of each month
- Retrospective: Last Friday of each month

Please confirm your availability.

Best regards,
John

From manager@company.com Mon Jan 20 10:30:00 2026
From: Project Manager <manager@company.com>
To: team@company.com
Subject: URGENT: Deadline Reminder for Project Alpha
Date: Mon, 20 Jan 2026 10:30:00 +0530
Message-ID: <20260120103000.DEF456@company.com>
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<head><title>Urgent Notice</title></head>
<body style="font-family: Arial, sans-serif;">
<div style="background: #ff6b6b; color: white; padding: 15px; border-radius: 5px;">
<h2>⚠️ URGENT: Deadline Reminder</h2>
</div>
<p>Team,</p>
<p>This is a reminder that <strong>Project Alpha</strong> is due on <em>January 31, 2026</em>.</p>
<h3>Remaining Tasks:</h3>
<ul>
<li>Complete unit tests - <span style="color: orange;">In Progress</span></li>
<li>Code review - <span style="color: red;">Not Started</span></li>
<li>Documentation - <span style="color: green;">Complete</span></li>
<li>Deployment preparation - <span style="color: red;">Not Started</span></li>
</ul>
<p>Please update your task status in the project tracker.</p>
<p>Best,<br>Project Manager</p>
</body>
</html>

From newsletter@startup.io Mon Jan 20 12:00:00 2026
From: Startup Weekly <newsletter@startup.io>
To: subscriber@example.com
Subject: 🚀 This Week in Tech: AI Breakthroughs & More
Date: Mon, 20 Jan 2026 12:00:00 +0530
Message-ID: <20260120120000.GHI789@startup.io>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="----=_NextPart_001"

------=_NextPart_001
Content-Type: text/plain; charset="UTF-8"

STARTUP WEEKLY NEWSLETTER
=========================

Top Stories This Week:

1. AI Breakthrough: New model achieves human-level reasoning
2. Funding News: Cloud startup raises $500M Series D
3. Product Launch: Revolutionary battery technology announced
4. IPO Watch: Three unicorns preparing for public offering

Read more at: https://startup.io/newsletter

------=_NextPart_001
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<head><title>Startup Weekly</title></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px;">
<div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
<div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center;">
<h1 style="color: white; margin: 0;">🚀 Startup Weekly</h1>
<p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0;">Your weekly dose of tech news</p>
</div>
<div style="padding: 30px;">
<h2 style="color: #1f2937;">Top Stories This Week</h2>
<div style="border-left: 4px solid #6366f1; padding-left: 15px; margin: 20px 0;">
<h3 style="margin: 0; color: #374151;">AI Breakthrough</h3>
<p style="color: #6b7280;">New model achieves human-level reasoning in benchmark tests</p>
</div>
<div style="border-left: 4px solid #10b981; padding-left: 15px; margin: 20px 0;">
<h3 style="margin: 0; color: #374151;">Funding News</h3>
<p style="color: #6b7280;">Cloud startup raises $500M Series D at $5B valuation</p>
</div>
<div style="border-left: 4px solid #f59e0b; padding-left: 15px; margin: 20px 0;">
<h3 style="margin: 0; color: #374151;">Product Launch</h3>
<p style="color: #6b7280;">Revolutionary battery technology promises 10x capacity</p>
</div>
</div>
<div style="background: #f9fafb; padding: 20px; text-align: center;">
<p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Startup Weekly. All rights reserved.</p>
</div>
</div>
</body>
</html>

------=_NextPart_001--

From support@service.com Mon Jan 20 14:00:00 2026
From: Customer Support <support@service.com>
To: customer@example.com
Subject: Re: Ticket #12345 - Your Issue Has Been Resolved
Date: Mon, 20 Jan 2026 14:00:00 +0530
Message-ID: <20260120140000.JKL012@service.com>
In-Reply-To: <original-ticket@customer.example.com>
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"

Dear Valued Customer,

Thank you for contacting our support team.

We're pleased to inform you that your issue (Ticket #12345) has been resolved.

Issue Summary:
- Problem: Unable to access account after password reset
- Resolution: Account access restored, security settings updated

If you have any further questions, please don't hesitate to reach out.

Satisfaction Survey: https://service.com/survey/12345

Best regards,
Customer Support Team
Service.com

---
Ticket ID: #12345
Priority: High
Category: Account Access
Resolution Time: 2 hours

From security@bank.example Mon Jan 20 16:00:00 2026
From: Security Alert <security@bank.example>
To: account.holder@example.com
Subject: 🔒 Security Alert: New Login Detected
Date: Mon, 20 Jan 2026 16:00:00 +0530
Message-ID: <20260120160000.MNO345@bank.example>
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<head><title>Security Alert</title></head>
<body style="font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px;">
<div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
<div style="text-align: center; margin-bottom: 20px;">
<span style="font-size: 48px;">🔒</span>
<h2 style="color: #1a1a1a; margin: 10px 0;">Security Alert</h2>
</div>
<p style="color: #333;">Dear Account Holder,</p>
<p style="color: #333;">We detected a new login to your account:</p>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #f5f5f5;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Date/Time:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">January 20, 2026 at 3:45 PM</td>
</tr>
<tr>
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Location:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">Mumbai, India</td>
</tr>
<tr style="background: #f5f5f5;">
<td style="padding: 10px; border: 1px solid #ddd;"><strong>Device:</strong></td>
<td style="padding: 10px; border: 1px solid #ddd;">Chrome on Windows</td>
</tr>
</table>
<p style="color: #333;">If this was you, no action is needed.</p>
<p style="color: #e74c3c;"><strong>If this wasn't you, please contact us immediately.</strong></p>
<div style="text-align: center; margin-top: 20px;">
<a href="#" style="background: #e74c3c; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px;">Report Suspicious Activity</a>
</div>
<p style="color: #888; font-size: 12px; margin-top: 30px; text-align: center;">
This is an automated security notification. Please do not reply to this email.
</p>
</div>
</body>
</html>

'''
    filepath = os.path.join(OUTPUT_DIR, "comprehensive_mailbox.mbox")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(mbox_content)
    print(f"Created: {filepath}")
    return filepath

def create_simple_msg_file(filepath, subject, sender, recipient, body):
    """
    Create a minimal MSG-like file.
    MSG files are complex OLE compound documents. Creating a fully valid MSG file
    requires extensive OLE structure handling. Instead, we'll create a simplified
    version that contains the email metadata in a structured format.
    
    For true MSG testing, consider using actual sample MSG files.
    """
    # Create a simple structured file that mimics MSG structure
    # This is a simplified format - real MSG files are OLE compound documents
    
    try:
        import olefile
        from io import BytesIO
        
        # Unfortunately, olefile is read-only. We'll create a text-based format
        # that can be identified as email-like content.
        pass
    except ImportError:
        pass
    
    # Create a binary file with MSG-like markers
    # Real MSG files start with OLE signature: D0 CF 11 E0 A1 B1 1A E1
    # We'll create a simplified version with clear email content
    
    with open(filepath, 'wb') as f:
        # OLE signature (marks this as a compound document)
        ole_signature = bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])
        
        # Since we can't create a fully valid OLE structure easily,
        # let's create an RFC822-style message that the converter might handle
        # with .msg extension as a fallback
        
        # Actually, let's try a different approach - create proper email content
        email_content = f"""Subject: {subject}
From: {sender}
To: {recipient}
Date: Mon, 20 Jan 2026 10:00:00 +0530
MIME-Version: 1.0
Content-Type: text/plain; charset="UTF-8"

{body}
"""
        f.write(email_content.encode('utf-8'))
    
    print(f"Created: {filepath}")
    return filepath

def download_sample_msg():
    """Download a real sample MSG file for testing."""
    import urllib.request
    
    # There are various sample MSG files available online
    # We'll try to get one from a reliable source
    sample_urls = [
        # Microsoft sample documents repository
        "https://github.com/TeamMsgExtractor/msg-extractor/raw/master/example-msg-files/unicode.msg",
    ]
    
    filepath = os.path.join(OUTPUT_DIR, "sample_outlook.msg")
    
    for url in sample_urls:
        try:
            print(f"Downloading MSG sample from {url}...")
            urllib.request.urlretrieve(url, filepath)
            print(f"Created: {filepath}")
            return filepath
        except Exception as e:
            print(f"Failed to download from {url}: {e}")
    
    return None

def create_eml_as_msg_alternative(filename, subject, sender, recipient, body_html):
    """Create an EML file as a .msg alternative that contains rich content."""
    filepath = os.path.join(OUTPUT_DIR, filename)
    
    content = f"""From: {sender}
To: {recipient}
Subject: {subject}
Date: Mon, 20 Jan 2026 10:00:00 +0530
Message-ID: <{filename.replace('.', '-')}@example.com>
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"

{body_html}
"""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {filepath}")
    return filepath

def create_msg_with_olefile():
    """
    Attempt to create MSG files using olefile structure.
    This is complex as MSG format requires specific stream structure.
    """
    print("\nNote: Creating proper MSG files requires Microsoft Outlook or specialized tools.")
    print("Creating EML files with .msg extension as alternatives for testing...")
    
    # Create rich EML content that mimics what MSG files typically contain
    
    # 1. Business Email MSG
    create_eml_as_msg_alternative(
        "business_report.msg",
        "Q4 Financial Report - Action Required",
        "CFO Office <cfo@corporation.com>",
        "executives@corporation.com",
        """<!DOCTYPE html>
<html>
<head><title>Q4 Financial Report</title></head>
<body style="font-family: 'Calibri', Arial, sans-serif; margin: 20px;">
<div style="border-bottom: 3px solid #0078D4; padding-bottom: 10px; margin-bottom: 20px;">
<h1 style="color: #0078D4; margin: 0;">📊 Q4 2025 Financial Report</h1>
<p style="color: #666; margin: 5px 0 0 0;">Confidential - Internal Use Only</p>
</div>

<p>Dear Executive Team,</p>

<p>Please find below the summary of our Q4 2025 financial performance:</p>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #0078D4; color: white;">
<th style="padding: 12px; text-align: left;">Metric</th>
<th style="padding: 12px; text-align: right;">Q4 2025</th>
<th style="padding: 12px; text-align: right;">Q4 2024</th>
<th style="padding: 12px; text-align: right;">Change</th>
</tr>
<tr>
<td style="padding: 10px; border-bottom: 1px solid #ddd;">Revenue</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$45.2M</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$38.1M</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: green;">+18.6%</td>
</tr>
<tr style="background: #f9f9f9;">
<td style="padding: 10px; border-bottom: 1px solid #ddd;">Net Income</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$8.7M</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">$6.2M</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: green;">+40.3%</td>
</tr>
<tr>
<td style="padding: 10px; border-bottom: 1px solid #ddd;">Operating Margin</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">19.2%</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">16.3%</td>
<td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right; color: green;">+2.9pp</td>
</tr>
</table>

<p><strong>Key Highlights:</strong></p>
<ul>
<li>Record quarterly revenue driven by cloud services growth</li>
<li>Customer acquisition costs reduced by 15%</li>
<li>New enterprise contracts worth $12M signed</li>
</ul>

<p>Please review and confirm receipt by end of day Friday.</p>

<p>Best regards,<br>
<strong>Office of the CFO</strong></p>
</body>
</html>"""
    )
    
    # 2. Meeting Invite MSG
    create_eml_as_msg_alternative(
        "meeting_invite.msg",
        "📅 Strategy Meeting - January 25, 2026 at 2:00 PM",
        "Calendar <calendar@corporation.com>",
        "team@corporation.com",
        """<!DOCTYPE html>
<html>
<head><title>Meeting Invite</title></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5;">
<div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

<div style="background: #0078D4; color: white; padding: 20px;">
<h2 style="margin: 0;">📅 Meeting Invitation</h2>
</div>

<div style="padding: 25px;">
<h3 style="color: #333; margin-top: 0;">Strategy Planning Session - Q1 2026</h3>

<table style="width: 100%; margin: 20px 0;">
<tr>
<td style="padding: 8px 0; color: #666; width: 100px;">📆 When:</td>
<td style="padding: 8px 0;"><strong>Friday, January 25, 2026</strong><br>2:00 PM - 4:00 PM IST</td>
</tr>
<tr>
<td style="padding: 8px 0; color: #666;">📍 Where:</td>
<td style="padding: 8px 0;"><strong>Conference Room A</strong><br>Also available via Teams</td>
</tr>
<tr>
<td style="padding: 8px 0; color: #666;">👥 Attendees:</td>
<td style="padding: 8px 0;">Leadership Team, Department Heads</td>
</tr>
</table>

<div style="background: #f0f7ff; border-left: 4px solid #0078D4; padding: 15px; margin: 20px 0;">
<strong>Agenda:</strong>
<ol style="margin: 10px 0; padding-left: 20px;">
<li>Q4 2025 Review (30 min)</li>
<li>Q1 2026 Objectives (45 min)</li>
<li>Budget Allocation (30 min)</li>
<li>Q&A (15 min)</li>
</ol>
</div>

<div style="margin-top: 30px; text-align: center;">
<a href="#" style="background: #107C10; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 0 5px;">✓ Accept</a>
<a href="#" style="background: #D83B01; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 0 5px;">✗ Decline</a>
<a href="#" style="background: #8A8886; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 0 5px;">? Tentative</a>
</div>

</div>
</div>
</body>
</html>"""
    )
    
    # 3. Invoice Email MSG
    create_eml_as_msg_alternative(
        "invoice_notification.msg",
        "Invoice #INV-2026-0001 - Payment Due",
        "Billing <billing@vendor.com>",
        "accounts@customer.com",
        """<!DOCTYPE html>
<html>
<head><title>Invoice</title></head>
<body style="font-family: Arial, sans-serif; margin: 20px; background: #f9f9f9;">
<div style="max-width: 650px; margin: 0 auto; background: white; padding: 30px; border-radius: 5px;">

<div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
<h1 style="color: #333; margin: 0;">INVOICE</h1>
<p style="color: #666; margin: 5px 0;">#INV-2026-0001</p>
</div>

<table style="width: 100%; margin-bottom: 30px;">
<tr>
<td style="vertical-align: top;">
<strong>From:</strong><br>
Vendor Solutions Ltd.<br>
123 Business Park<br>
Mumbai, MH 400001<br>
</td>
<td style="vertical-align: top; text-align: right;">
<strong>To:</strong><br>
Customer Corp.<br>
456 Enterprise Ave<br>
Bangalore, KA 560001<br>
</td>
</tr>
</table>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr style="background: #333; color: white;">
<th style="padding: 12px; text-align: left;">Description</th>
<th style="padding: 12px; text-align: center;">Qty</th>
<th style="padding: 12px; text-align: right;">Unit Price</th>
<th style="padding: 12px; text-align: right;">Total</th>
</tr>
<tr>
<td style="padding: 12px; border-bottom: 1px solid #ddd;">Software License - Enterprise</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">10</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹15,000</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹1,50,000</td>
</tr>
<tr style="background: #f5f5f5;">
<td style="padding: 12px; border-bottom: 1px solid #ddd;">Support & Maintenance (Annual)</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">1</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹30,000</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹30,000</td>
</tr>
<tr>
<td style="padding: 12px; border-bottom: 1px solid #ddd;">Implementation Services</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: center;">40 hrs</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹2,000/hr</td>
<td style="padding: 12px; border-bottom: 1px solid #ddd; text-align: right;">₹80,000</td>
</tr>
</table>

<table style="width: 300px; margin-left: auto;">
<tr>
<td style="padding: 8px;"><strong>Subtotal:</strong></td>
<td style="padding: 8px; text-align: right;">₹2,60,000</td>
</tr>
<tr>
<td style="padding: 8px;"><strong>GST (18%):</strong></td>
<td style="padding: 8px; text-align: right;">₹46,800</td>
</tr>
<tr style="background: #333; color: white;">
<td style="padding: 12px;"><strong>TOTAL DUE:</strong></td>
<td style="padding: 12px; text-align: right;"><strong>₹3,06,800</strong></td>
</tr>
</table>

<div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107;">
<strong>⚠️ Payment Due:</strong> February 1, 2026<br>
<strong>Bank:</strong> HDFC Bank | <strong>Account:</strong> XXXX-XXXX-1234
</div>

</div>
</body>
</html>"""
    )

def main():
    print("=" * 60)
    print("Creating Email Sample Files for AV Pipeline Testing")
    print("=" * 60)
    
    # Create comprehensive MBOX
    print("\n📧 Creating comprehensive MBOX file...")
    create_mbox_comprehensive()
    
    # Create MSG files (as EML with .msg extension for testing)
    print("\n📨 Creating MSG-format files...")
    create_msg_with_olefile()
    
    # Try to download a real MSG sample
    print("\n📥 Attempting to download real MSG sample...")
    download_sample_msg()
    
    print("\n" + "=" * 60)
    print("✅ Sample files created successfully!")
    print("=" * 60)
    print("\nNote about MSG/PST files:")
    print("- MSG files are Microsoft Outlook proprietary OLE compound documents")
    print("- PST files are Outlook Personal Storage Table files")
    print("- Creating valid MSG/PST files requires Microsoft tools or specialized libraries")
    print("- The .msg files created are EML-format emails with MSG extension for testing")
    print("- For full MSG/PST testing, use actual Outlook-exported files")

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Create a minimal PST-like file for testing.
Note: True PST files require Microsoft's proprietary format.
This creates a test file that can help verify the pipeline's error handling.
"""

import os
import struct

OUTPUT_DIR = "/home/petals/work/avpipelinefinish/sample data/01_email_samples"

def create_minimal_pst():
    """
    Create a minimal PST file structure.
    
    PST files have a specific header:
    - Signature: "!BDN" (0x21, 0x42, 0x44, 0x4E) for ANSI PST
    - Or unicode signature for Unicode PST
    
    This creates a minimal file that the converter can attempt to process.
    Real PST processing may still fail, but it tests the file type detection.
    """
    filepath = os.path.join(OUTPUT_DIR, "minimal_test.pst")
    
    with open(filepath, 'wb') as f:
        # PST file signature (ANSI format)
        # Magic bytes: "!BDN" followed by specific header structure
        
        # Offset 0: dwMagic - File signature
        f.write(b'!BDN')  # 0x21424E44
        
        # Offset 4: dwCRCPartial (placeholder)
        f.write(struct.pack('<I', 0))
        
        # Offset 8: wMagicClient (e.g., SM = 0x534D)
        f.write(b'SM')
        
        # Offset 10: wVer (PST format version)
        f.write(struct.pack('<H', 23))  # Version 23 = Unicode PST
        
        # Offset 12: wVerClient
        f.write(struct.pack('<H', 19))
        
        # Offset 14: bPlatformCreate
        f.write(struct.pack('<B', 0x01))  # Windows
        
        # Offset 15: bPlatformAccess
        f.write(struct.pack('<B', 0x01))  # Windows
        
        # Offset 16: dwReserved1
        f.write(struct.pack('<I', 0))
        
        # Offset 20: dwReserved2
        f.write(struct.pack('<I', 0))
        
        # Pad to at least 512 bytes (minimum PST header size)
        current_pos = f.tell()
        if current_pos < 512:
            f.write(b'\x00' * (512 - current_pos))
    
    print(f"Created minimal PST test file: {filepath}")
    
    # Verify
    with open(filepath, 'rb') as f:
        sig = f.read(4)
        print(f"  Signature: {sig} (should be b'!BDN')")
    
    return filepath

def create_sample_pst_from_msg():
    """
    Create a PST-like file by wrapping email content.
    This is for testing purposes only - not a valid PST.
    """
    filepath = os.path.join(OUTPUT_DIR, "test_email_archive.pst")
    
    # Create an email archive format
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write("=== EMAIL ARCHIVE ===\n\n")
        
        emails = [
            {
                "from": "john@example.com",
                "to": "jane@example.com", 
                "subject": "Project Update",
                "date": "2026-01-20 10:00:00",
                "body": "Hi Jane,\n\nThe project is on track.\n\nBest,\nJohn"
            },
            {
                "from": "boss@company.com",
                "to": "team@company.com",
                "subject": "Q1 Meeting",
                "date": "2026-01-20 11:00:00", 
                "body": "Team,\n\nPlease join the Q1 planning meeting.\n\nRegards,\nBoss"
            },
            {
                "from": "support@vendor.com",
                "to": "customer@example.com",
                "subject": "Ticket Resolution",
                "date": "2026-01-20 12:00:00",
                "body": "Your support ticket has been resolved.\n\nThank you."
            }
        ]
        
        for i, email in enumerate(emails, 1):
            f.write(f"--- Email {i} ---\n")
            f.write(f"From: {email['from']}\n")
            f.write(f"To: {email['to']}\n")
            f.write(f"Subject: {email['subject']}\n")
            f.write(f"Date: {email['date']}\n")
            f.write(f"Body:\n{email['body']}\n")
            f.write("---\n\n")
    
    print(f"Created test archive: {filepath}")
    print("  Note: This is not a real PST - for testing error handling only")
    return filepath

if __name__ == "__main__":
    print("Creating PST test files...\n")
    create_minimal_pst()
    print()
    create_sample_pst_from_msg()
    print("\nDone!")
    print("\nNote: For real PST testing, export a PST from Microsoft Outlook.")
    print("The MSG file (sample_outlook.msg) IS a valid Outlook format and should work.")

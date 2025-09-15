// file: client/src/constants/conversion.ts

import { FileArchive, FileText, Inbox, Mail, Wand2 } from "lucide-react"; // Add Wand2

export const CONVERSION_TYPES = [
    // *** FIX STARTS HERE: Add the new universal option ***
    {
      id: "any-to-html",
      label: "Any File → HTML",
      icon: Wand2,
      description: "Auto-detect and convert all supported file types to HTML",
    },
    // *** FIX ENDS HERE ***
    {
      id: "eml",
      label: "EML → HTML",
      icon: Mail,
      description: "Convert email files to HTML format",
    },
    {
      id: "msg",
      label: "MSG → HTML",
      icon: Inbox,
      description: "Convert Outlook messages to HTML format",
    },
    {
      id: "pst",
      label: "PST → HTML",
      icon: FileArchive,
      description: "Extract and convert PST archives",
    },
    {
      id: "mbox",
      label: "MBOX → HTML",
      icon: FileText,   
      description: "Convert MBOX files to HTML format",
    },
  ];
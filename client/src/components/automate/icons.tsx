import {
  Archive,
  File,
  Shield,
  Filter,
  CheckSquare,
  Trash2,
  Workflow,
} from "lucide-react";
import React from "react";

import { FlowStepType } from "@/types/automate";

export function getStepIcon(type: FlowStepType) {
  switch (type) {
    case FlowStepType.EXTRACTION:
      return <Archive className="h-5 w-5 text-indigo-500" />;
    case FlowStepType.CONVERSION:
      return <File className="h-5 w-5 text-blue-500" />;
    case FlowStepType.AV_SCAN:
      return <Shield className="h-5 w-5 text-red-500" />;
    case FlowStepType.REMOVAL:
      return <Filter className="h-5 w-5 text-amber-500" />;
    case FlowStepType.VERIFICATION:
      return <CheckSquare className="h-5 w-5 text-green-500" />;
    case FlowStepType.VERIFY_REMOVAL:
      return <Trash2 className="h-5 w-5 text-rose-500" />;
    default:
      return <Workflow className="h-5 w-5" />;
  }
}

export function getStepTitle(type: FlowStepType) {
  switch (type) {
    case FlowStepType.EXTRACTION:
      return "Extract Files";
    case FlowStepType.CONVERSION:
      return "Convert Files";
    case FlowStepType.AV_SCAN:
      return "Scan Files";
    case FlowStepType.REMOVAL:
      return "Remove File Types";
    case FlowStepType.VERIFICATION:
      return "Verify Files";
    case FlowStepType.VERIFY_REMOVAL:
      return "Verify Removal of Original Files";
    default:
      return "Step";
  }
}

export function getStepDescription(type: FlowStepType) {
  switch (type) {
    case FlowStepType.EXTRACTION:
      return "Extract files from archives and containers";
    case FlowStepType.CONVERSION:
      return "Convert files to desired formats";
    case FlowStepType.AV_SCAN:
      return "Scan files with antivirus engines";
    case FlowStepType.REMOVAL:
      return "Remove specified file types";
    case FlowStepType.VERIFICATION:
      return "Verify file integrity and content";
    case FlowStepType.VERIFY_REMOVAL:
      return "Verify removal of original files after processing";
    default:
      return "";
  }
}

// Define a CheckIcon component to use in the checkboxes
export function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

import { ReactNode } from 'react';
import { CheckCircle, AlertCircle } from "lucide-react";
import { FlowStepType } from '@/types/automate';
import { StepStatus } from './types';
import { ConversionTypes } from '@/types/conversion';

// Helper function to get status badge color and icon
export const getStatusBadge = (status: StepStatus): { color: string; icon: ReactNode; bgColor: string } => {
  switch (status) {
    case 'pending':
      return { 
        color: 'text-slate-600', 
        icon: <span className="h-2 w-2 rounded-full bg-slate-400 mr-1.5"></span>,
        bgColor: 'bg-slate-50' 
      };
    case 'in-progress':
      return { 
        color: 'text-blue-600', 
        icon: <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse mr-1.5"></span>,
        bgColor: 'bg-blue-50' 
      };
    case 'completed':
      return { 
        color: 'text-green-600', 
        icon: <CheckCircle className="h-3.5 w-3.5 mr-1" />,
        bgColor: 'bg-green-50' 
      };
    case 'error':
      return { 
        color: 'text-red-600', 
        icon: <AlertCircle className="h-3.5 w-3.5 mr-1" />,
        bgColor: 'bg-red-50' 
      };
    default:
      return { 
        color: 'text-slate-600', 
        icon: <span className="h-2 w-2 rounded-full bg-slate-400 mr-1.5"></span>,
        bgColor: 'bg-slate-50' 
      };
  }
};

// Helper function to get step title
export const getStepTitle = (type: FlowStepType): string => {
  switch (type) {
    case FlowStepType.EXTRACTION: return 'Extract';
    case FlowStepType.CONVERSION: return 'Convert';
    case FlowStepType.AV_SCAN: return 'Scan';
    case FlowStepType.REMOVAL: return 'Remove File Types';
    case FlowStepType.VERIFICATION: return 'Verify';
    case FlowStepType.VERIFY_REMOVAL: return 'Remove Originals';
    default: return type;
  }
};

// Helper function to get a format display name
export const getFormatDisplayName = (format: ConversionTypes): string => {
  const formatMap: Record<string, string> = {
    'eml': 'EML Files',
    'msg': 'MSG Files',
    'pst': 'PST Archives',
    'word': 'Word Documents',
    'all': 'All Formats'
  };
  return formatMap[format] || format;
};

// Helper function to get an engine display name
export const getEngineDisplayName = (engine: string): string => {
  const engineMap: Record<string, string> = {
    'windows-defender': 'Windows Defender',
    'trend-micro': 'Trend Micro',
    'clam-av': 'ClamAV',
    'eset': 'ESET',
    'quick-heal': 'Quick Heal'
  };
  return engineMap[engine] || engine;
};

// Helper function to get a file type display name
export const getFileTypeDisplayName = (fileType: string): string => {
  const fileTypeMap: Record<string, string> = {
    'bat': 'Batch Files (.bat)',
    'exe': 'Executables (.exe)',
    'js': 'JavaScript (.js)',
    'vbs': 'VBScript (.vbs)',
    'ps1': 'PowerShell (.ps1)',
    'cmd': 'Command Files (.cmd)',
    'sh': 'Shell Scripts (.sh)'
  };
  return fileTypeMap[fileType] || fileType;
};

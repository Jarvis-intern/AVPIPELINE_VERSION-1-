import { FlowStep } from '@/types/automate';

// Step status types
export type StepStatus = 'pending' | 'in-progress' | 'completed' | 'error' | 'warning';

// Interface for file processing statistics
export interface FileStats {
  totalFiles: number;
  processedFiles: number;
  fileSize: string;
  status: StepStatus;
  timeTaken?: string;
  error?: string;
}

// Interface for conversion format statistics
export interface FormatStats {
  format: string;
  totalFiles: number;
  convertedFiles: number;
  status: StepStatus;
  timeTaken?: string;
}

// Interface for scan statistics
export interface ScanStats {
  engine: string;
  totalFiles: number;
  scannedFiles: number;
  threatsFound: number;
  status: StepStatus;
  timeTaken?: string;
}

// Define the props interface for our component
export interface TaskDetailsUIProps {
  taskId: string;
  taskName: string;
  description: string;
  assignee: string;
  systemIp: string;
  createdAt: string;
  workflowSteps: {
    step: FlowStep;
    status: StepStatus;
    progress: number;
    stats: {
      extract?: FileStats;
      convert?: FormatStats[];
      scan?: ScanStats[];
      removeFileTypes?: FileStats;
      verify?: { status: StepStatus };
      removeOriginals?: FileStats;
    };
  }[];
  onSkipStep?: (stepId: number) => void;
  onAbortWorkflow?: (stepId: number) => void;
}

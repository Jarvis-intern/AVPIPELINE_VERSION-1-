// Types for the Automation feature
export interface TaskFormData {
  name: string;
  description: string;
  assignee: string;
  systemIp: string;
}

export enum LogLevel {
  INFO = 0,
  WARNING = 1,
  ERROR = 2,
  DEBUG = 3,
}

export interface ScanLog {
  scanId: string; // Scan ID this log belongs to
  content: string; // Log content
  timestamp: string; // Timestamp of the log
  level: LogLevel; // Log level
  filePath: string; // File path being scanned (if applicable)
  progress: number; // Scan progress (0-100)
}

export interface TaskWorkflowData {
  stage1: number | null;
  stage2: number | null;
  stage3: number | null;
  stage4: number | null;
  stage5: number | null;
  stage6: number | null;
  conversion: string[];
  removal: string[];
  avs: string[];
  verify_removal: string[];
  auto_proceed: boolean;
  isOrganized: boolean;
}

export interface FlowStep {
  id: number;
  type: FlowStepType;
  conversion?: string[];
  removal?: string[];
  avs?: string[];
  auto_proceed?: boolean;
  verify_removal?: string[];
  enabled?: boolean;
  isOrganized?: boolean;
  [key: string]: any;
}

export interface Stage {
  id: number;
  name: string;
}

export enum FlowStepType {
  EXTRACTION = "EXTRACTION",
  CONVERSION = "CONVERSION",
  REMOVAL = "REMOVAL",
  VERIFICATION = "VERIFICATION",
  VERIFY_REMOVAL = "VERIFY_REMOVAL",
  AV_SCAN = "AV_SCAN",
}

export enum StageStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  DONE = "DONE",
  ERROR = "ERROR",
}

type BaseStageProgress = {
  type: FlowStepType;
  progress: number;
  status: StageStatus;
  message?: string;
};

export interface ConversionTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  convertedFiles: number;
  failedFiles: number;
  convertedFilesList: string[];
  failedFilesList: string[];
  currentPhase: number;
  error?: string;
}

export interface RemovalTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  removedFiles: number;
  failedFiles: number;
  removedFilesList: string[];
  failedFilesList: string[];
  error?: string;
}

export interface VerifyRemovalTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  removedFiles: number;
  failedFiles: number;
  removedFilesList: string[];
  failedFilesList: string[];
  error?: string;
}

export type ExtractionProgress = BaseStageProgress & {
  type: FlowStepType.EXTRACTION;
  currentFile: string;
  currFileNumber: number;
  filesCount: number;
};
export type ConversionProgress = BaseStageProgress & {
  type: FlowStepType.CONVERSION;
  currConversionType: string;
  currentFile: string;
  currFileNumber: number;
  filesCount: number;
  conversionResults: ConversionTypeResult[];
};
export type RemovalProgress = BaseStageProgress & {
  type: FlowStepType.REMOVAL;
  currRemovalType: string;
  currTypeFilesCount: number;
  currTypeNumber: number;
  totalTypes: number;
  totalRemovalFiles: number;
  totalRemovedCount: number;
  removalResults: RemovalTypeResult[];
};
export type VerificationProgress = BaseStageProgress & {
  type: FlowStepType.VERIFICATION;
  auto_proceed: boolean;
};
export type VerifyRemovalProgress = BaseStageProgress & {
  type: FlowStepType.VERIFY_REMOVAL;
  currVerifyRemovalType: string;
  currTypeFilesCount: number;
  currTypeNumber: number;
  totalTypes: number;
  totalVerifyRemovalFiles: number;
  totalRemovedCount: number;
  verifyRemovalResults: VerifyRemovalTypeResult[];
};
export type AvScanProgress = BaseStageProgress & {
  type: FlowStepType.AV_SCAN;
  isOrganized: boolean;
  avScanData: {
    avName: string;
    scanLogs: ScanLog[];
    status: "DONE" | "PENDING" | "RUNNING";
    startTime?: string;
    endTime?: string;
  }[];
  scanPath?: string;
};

export type StageProgress =
  | ExtractionProgress
  | ConversionProgress
  | RemovalProgress
  | VerificationProgress
  | VerifyRemovalProgress
  | AvScanProgress;

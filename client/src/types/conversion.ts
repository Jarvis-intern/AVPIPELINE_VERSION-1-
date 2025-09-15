export enum ConversionRoutes {
  FILE = "file", // Add FILE
  FOLDER = "folder",
  SETTINGS = "settings",
}

export enum ConversionTypes {
  EML = "EML",
  HTML = "HTML",
  PDF = "PDF",
  DOCX = "DOCX",
  DOC = "DOC",
  XLSX = "XLSX",
  XLS = "XLS",
  CSV = "CSV",
  JSON = "JSON",
  XML = "XML",
  TXT = "TXT",
  MD = "MD",
}

export interface ConversionSocketResponse {
  conversion_type: string;
  phase: number;
  files: string[];
  converted_files: number;
  failed_files: number;
  size: number;
}

export interface ConversionApiResponse {
  conversion_type: string;
  path: string;
  start_time: string;
  end_time: string;
  total_files: number;
  total_size: number;
  total_converted: number;
  total_failed: number;
  converted_files: string[];
  failed_files: string[];
}

export interface ConversionStartedEvent {
  conversion_type: string;
  path: string;
  start_time: string;
}

export interface PhaseStartedEvent {
  conversion_type: string;
  phase: number;
  total_files: number;
  total_size: number;
}

export interface FileProgressEvent {
  conversion_type: string;
  phase: number;
  current_file: string;
  success: boolean;
  converted_count: number;
  failed_count: number;
  total_files: number;
  error?: string;
}

export interface PhaseCompletedEvent {
  conversion_type: string;
  phase: number;
  converted_files: number;
  failed_files: number;
  total_files: number;
  size: number;
}

export interface ConversionCompletedEvent {
  conversion_type: string;
  path: string;
  start_time: string;
  end_time: string;
  total_files: number;
  total_size: number;
  total_converted: number;
  total_failed: number;
  converted_files: string[];
  failed_files: string[];
}

export interface ConversionErrorEvent {
  error: string;
  conversion_type: string;
  path: string;
}

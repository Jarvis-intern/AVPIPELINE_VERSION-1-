import { LucideIcon } from "lucide-react";

export interface AV {
  id?: string;
  name: string;
  ip_address: string;
  username: string;
  password: string;
  status: boolean;
  description?: string;
  active: boolean;
  version?: string;
  signature_version?: string;
  last_update?: string;
  scan_command: string;
  check_command: string;
  info_command: string;
  created_at?: string;
  updated_at?: string;
}

export interface AVResource {
  cpu: Array<{ timestamp: string; value: number }>;
  memory: Array<{ timestamp: string; value: number }>;
  disk: Array<{ timestamp: string; value: number }>;
}

// export interface ScanResponse {
//   scan_id: string;
//   status: string;
//   progress: number;
//   files_scanned: number;
//   infected_files: number;
//   total_files: number;
//   total_size: number;
//   infected_files_list: InfectedFile[];
//   error_output?: string;
//   log_output: string;
//   scan_duration: string;
//   scan_type: string;
//   scan_start_time: string;
//   scan_end_time: string;
// }

// export interface InfectedFile {
//   file_path: string;
//   virus_name: string;
//   file_size: number;
//   last_modified: string;
//   detection_time: string;
// }

export interface AVEngine {
  id: string;
  name: string;
  status: string;
  available: boolean;
  enabled: boolean;
  lastUpdate: string;
  progress: number;
  infected: number;
  scanned: number;
}

export interface ConversionType {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
}

export interface RecentConversion {
  path: string;
  type: string;
  totalFiles: number;
  converted: number;
  timestamp: string;
}

export interface RecentScan {
  file: string;
  status: "clean" | "infected";
  detectedBy: string[];
  timestamp: string;
  threat: string | null;
}

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

export interface InfectedFile {
  filePath: string;
  virusName: string;
}

export interface ErrorFile {
  filePath: string;
  errorMesg: string;
}

export interface AVParsedResult {
  totalScannedFiles: string[]; // list of file paths
  infectedFiles: InfectedFile[]; // list of infected file info
  errorFiles: ErrorFile[]; // list of file paths with errors
}

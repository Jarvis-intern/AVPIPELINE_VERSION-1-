export interface TaskApiResponse {
  id: number;
  unique_id: string;
  name: string;
  description: string;
  file_path: string;
  av_file_path: string;
  stage1: number;
  stage2: number;
  stage3: number;
  stage4: number;
  stage5: number;
  stage6: number;
  zip: string;
  conversion: string[];
  removal: string[];
  verify_removal: string[];
  auto_proceed: boolean;
  isOrganized: boolean;
  avs: string[];
  assignee: string;
  system_ip: string;
}

import { FlowStep, TaskFormData, FlowStepType } from "@/types/automate";

// Default initial values
export const DEFAULT_TASK_DATA: TaskFormData = {
  name: "",
  description: "",
  assignee: "",
  systemIp: "192.168.1.45",
};

// Default tab and step settings
export const DEFAULT_ACTIVE_TAB = "task";
export const DEFAULT_CURRENT_STEP = 1;

// Default notification settings
export const DEFAULT_NOTIFICATION_LEVEL = "all";

// Get all format IDs with proper typing
export const DEFAULT_CONVERSION_FORMATS: string[] = [];
export const DEFAULT_VERIFY_REMOVAL_FORMATS: string[] = [];
// Get all engine IDs with proper typing
export const DEFAULT_AVS: string[] = [];

// Get all file type IDs with proper typing
export const DEFAULT_FILE_TYPES: string[] = [];

// Default flow steps with all options selected
export const DEFAULT_FLOW_STEPS: FlowStep[] = [
  {
    id: 1,
    type: FlowStepType.EXTRACTION,
    enabled: true,
  },
  {
    id: 2,
    type: FlowStepType.CONVERSION,
    conversion: DEFAULT_CONVERSION_FORMATS, // start empty
    enabled: true,
  },
  {
    id: 3,
    type: FlowStepType.REMOVAL,
    removal: DEFAULT_FILE_TYPES, // start empty
    enabled: false,
  },
  {
    id: 4,
    type: FlowStepType.VERIFICATION,
    enabled: true,
  },
  {
    id: 5,
    type: FlowStepType.VERIFY_REMOVAL,
    verify_removal: DEFAULT_VERIFY_REMOVAL_FORMATS, // start empty
    enabled: true,
  },
  {
    id: 6,
    type: FlowStepType.AV_SCAN,
    avs: DEFAULT_AVS, // start empty
    enabled: true,
  },
];

export const DEFAULT_FILE_PATH = "";
export const DEFAULT_FILE_TYPE = "folder";
export const DEFAULT_SHOW_HELP_TIP = true;

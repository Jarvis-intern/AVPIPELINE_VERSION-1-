import { FlowStep, FlowStepType } from "@/types/automate";

import { TaskWorkflowData } from "@/types/automate";
import { TaskApiResponse } from "@/types/task";

export const formatTimeTaken = (startTime: string, endTime: string) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diff = end.getTime() - start.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

export const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString();
};

export const workFlowDataToTaskData = (workFlowData: FlowStep[]) => {
  let taskData: TaskWorkflowData = {
    stage1: null,
    stage2: null,
    stage3: null,
    stage4: null,
    stage5: null,
    stage6: null,
    conversion: [],
    removal: [],
    avs: [],
    verify_removal: [],
    auto_proceed: false,
    isOrganized: false,
  };

  switch (workFlowData.length) {
    case 1:
      taskData.stage1 = workFlowData[0].id;
      break;
    case 2:
      taskData.stage1 = workFlowData[0].id;
      taskData.stage2 = workFlowData[1].id;
      break;
    case 3:
      taskData.stage1 = workFlowData[0].id;
      taskData.stage2 = workFlowData[1].id;
      taskData.stage3 = workFlowData[2].id;
      break;
    case 4:
      taskData.stage1 = workFlowData[0].id;
      taskData.stage2 = workFlowData[1].id;
      taskData.stage3 = workFlowData[2].id;
      taskData.stage4 = workFlowData[3].id;
      break;
    case 5:
      taskData.stage1 = workFlowData[0].id;
      taskData.stage2 = workFlowData[1].id;
      taskData.stage3 = workFlowData[2].id;
      taskData.stage4 = workFlowData[3].id;
      taskData.stage5 = workFlowData[4].id;
      break;
    case 6:
      taskData.stage1 = workFlowData[0].id;
      taskData.stage2 = workFlowData[1].id;
      taskData.stage3 = workFlowData[2].id;
      taskData.stage4 = workFlowData[3].id;
      taskData.stage5 = workFlowData[4].id;
      taskData.stage6 = workFlowData[5].id;
      break;
  }

  workFlowData.forEach((step) => {
    switch (step.type) {
      case FlowStepType.CONVERSION:
        taskData.conversion = step.conversion || [];
        break;
      case FlowStepType.REMOVAL:
        taskData.removal = step.removal || [];
        break;
      case FlowStepType.AV_SCAN:
        taskData.avs = step.avs || [];
        break;
      case FlowStepType.VERIFICATION:
        taskData.auto_proceed = step.auto_proceed || false;
        taskData.isOrganized;
        break;
      case FlowStepType.VERIFY_REMOVAL:
        taskData.verify_removal = step.verify_removal || [];
        break;
    }
  });

  return taskData;
};

export const TaskDataToWorkFlowData = (taskData: TaskApiResponse) => {
  let workFlowData: FlowStep[] = [];

  Object.keys(taskData).forEach((key) => {
    if (!key.includes("stage")) return;
    if (taskData[key as keyof TaskApiResponse] === 1) {
      workFlowData.push({
        id: 1,
        type: FlowStepType.EXTRACTION,
        enabled: true,
      });
    } else if (taskData[key as keyof TaskApiResponse] === 2) {
      workFlowData.push({
        id: 2,
        type: FlowStepType.CONVERSION,
        conversion: taskData.conversion,
        enabled: true,
      });
    } else if (taskData[key as keyof TaskApiResponse] === 3) {
      workFlowData.push({
        id: 3,
        type: FlowStepType.REMOVAL,
        removal: taskData.removal,
        enabled: true,
      });
    } else if (taskData[key as keyof TaskApiResponse] === 4) {
      workFlowData.push({
        id: 4,
        type: FlowStepType.VERIFICATION,
        auto_proceed: taskData.auto_proceed,
        enabled: true,
      });
    } else if (taskData[key as keyof TaskApiResponse] === 5) {
      workFlowData.push({
        id: 5,
        type: FlowStepType.VERIFY_REMOVAL,
        verify_removal: taskData.verify_removal,
      });
    } else if (taskData[key as keyof TaskApiResponse] === 6) {
      workFlowData.push({
        id: 6,
        type: FlowStepType.AV_SCAN,
        avs: taskData.avs,
        isOrganized: taskData.isOrganized,
      });
    }
  });
  return workFlowData;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

import { FlowStep, FlowStepType, TaskFormData } from "@/types/automate";

export function validateTaskForm(taskData: TaskFormData) {
  return taskData.name.trim() !== "" && taskData.assignee.length !== 0;
}

export function validateWorkflowSelection(flowSteps: FlowStep[]) {
  return flowSteps.length > 0;
}

export function validateFileSelection(filePath: string) {
  return filePath.trim() !== "";
}

// Validate that at least one option is selected in each card
export function validateCardSelections(flowSteps: FlowStep[]): {
  isValid: boolean;
  invalidStepIndex?: number;
  stepType?: string;
} {
  for (let i = 0; i < flowSteps.length; i++) {
    const step = flowSteps[i];

    // Skip validation for step types that don't have selectable options
    if (
      step.type === FlowStepType.VERIFY_REMOVAL ||
      step.type === FlowStepType.VERIFICATION
    ) {
      continue;
    }

    // Check convert step - at least one format should be selected
    if (
      step.type === FlowStepType.CONVERSION &&
      (!step.conversion || step.conversion.length === 0)
    ) {
      return { isValid: false, invalidStepIndex: i, stepType: "convert" };
    }

    // Check scan step - at least one engine should be selected
    if (
      step.type === FlowStepType.AV_SCAN &&
      (!step.avs || step.avs.length === 0)
    ) {
      return { isValid: false, invalidStepIndex: i, stepType: "scan" };
    }

    // Check removeFileTypes step - at least one file type should be selected
    if (
      step.type === FlowStepType.REMOVAL &&
      (!step.removal || step.removal.length === 0)
    ) {
      return {
        isValid: false,
        invalidStepIndex: i,
        stepType: "removeFileTypes",
      };
    }
  }

  // All steps have at least one option selected
  return { isValid: true };
}

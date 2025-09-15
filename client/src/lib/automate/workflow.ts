import {
  DEFAULT_CONVERSION_FORMATS,
  DEFAULT_AVS,
  DEFAULT_FILE_TYPES,
} from "@/constants/automate";
import { FlowStep, FlowStepType } from "@/types/automate";

// Simple function to generate a unique ID for new steps
export function generateUniqueId(): string {
  return `step-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Create a new workflow step with all options selected by default
export function createNewStep(id: number, type: FlowStepType): FlowStep {
  // Create the base step structure
  const newStep: FlowStep = {
    id,
    type,
    enabled: true,
  };

  // Add appropriate options based on step type
  switch (type) {
    case FlowStepType.CONVERSION:
      // Select all format options by default
      newStep.conversion = [...DEFAULT_CONVERSION_FORMATS];
      break;
    case FlowStepType.AV_SCAN:
      // Select all engine options by default
      newStep.avs = [...DEFAULT_AVS];
      break;
    case FlowStepType.REMOVAL:
      // Select all file type options by default
      newStep.removal = [...DEFAULT_FILE_TYPES];
      break;
  }

  return newStep;
}

// Toggle an item in an array (add if not present, remove if present)
export function toggleItemInArray<T>(array: T[], item: T): T[] {
  // Create a copy of the array to avoid mutating the original
  const newArray = [...array];
  const index = newArray.indexOf(item);

  // If item is not in array, add it; otherwise remove it
  if (index === -1) {
    newArray.push(item);
  } else {
    newArray.splice(index, 1);
  }

  return newArray;
}

// Update a specific configuration value for a step
export function updateStepConfig(
  steps: FlowStep[],
  index: number,
  configKey: string,
  value: any
): FlowStep[] {
  // Create a new array with the updated step
  return steps.map((step, i) => {
    if (i === index) {
      // Only update the targeted step
      return {
        ...step,
        [configKey]: value,
      };
    }
    // Keep other steps unchanged
    return step;
  });
}

// Move a step from one position to another
export function moveStep(
  steps: FlowStep[],
  fromIndex: number,
  toIndex: number
): FlowStep[] {
  const newSteps = [...steps];
  // Remove the step from its current position
  const [movedStep] = newSteps.splice(fromIndex, 1);
  // Insert it at the new position
  newSteps.splice(toIndex, 0, movedStep);
  return newSteps;
}

// Toggle a format option for a conversion step
export function toggleFormat(
  steps: FlowStep[],
  index: number,
  format: string
): FlowStep[] {
  const step = steps[index];
  const formats = step.conversion || [];
  // Toggle the format in the array
  const updatedFormats = toggleItemInArray(formats, format);
  // Update the step with the new formats array
  return updateStepConfig(steps, index, "formats", updatedFormats);
}

// Toggle an engine option for a scan step
export function toggleEngine(
  steps: FlowStep[],
  index: number,
  engine: string
): FlowStep[] {
  const step = steps[index];
  const engines = step.avs || [];
  // Toggle the engine in the array
  const updatedEngines = toggleItemInArray(engines, engine);
  // Update the step with the new engines array
  return updateStepConfig(steps, index, "engines", updatedEngines);
}

// Toggle a file type option for a removeFileTypes step
export function toggleFileType(
  steps: FlowStep[],
  index: number,
  fileType: string
): FlowStep[] {
  const step = steps[index];
  const fileTypes = step.removal || [];
  // Toggle the file type in the array
  const updatedFileTypes = toggleItemInArray(fileTypes, fileType);
  // Update the step with the new fileTypes array
  return updateStepConfig(steps, index, "fileTypes", updatedFileTypes);
}

// Toggle all items of a certain type (select all or none)
export function toggleAllItems<T>(
  steps: FlowStep[],
  index: number,
  configKey: keyof FlowStep,
  allItems: T[]
): FlowStep[] {
  const step = steps[index];
  const currentItems = step[configKey] || [];

  // If all items are already selected, clear the selection
  // Otherwise, select all items
  const newItems =
    Array.isArray(currentItems) && currentItems.length === allItems.length
      ? []
      : [...allItems];

  // Update the step with the new items array
  return updateStepConfig(steps, index, configKey as string, newItems);
}

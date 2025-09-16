import { create } from "zustand";

import { DEFAULT_TASK_DATA, DEFAULT_FLOW_STEPS } from "@/constants/automate";
import { FlowStep, Stage, StageProgress, TaskFormData } from "@/types/automate";

interface AutomateStore {
  taskUniqueId: string | null;
  taskData: TaskFormData;
  workFlowData: FlowStep[];
  stages: Stage[];
  isLockMode: boolean;
  filePath: string;
  avFilePath: string;
  stageProgress: StageProgress[];
  wasResynced: boolean;
  isWorkflowDataLoaded: boolean;
  setFilePath: (filePath: string) => void;
  setAvFilePath: (filePath: string) => void;
  setTaskData: (data: TaskFormData) => void;
  setWorkFlowData: (data: FlowStep[]) => void;
  setTaskUniqueId: (id: string | null) => void;
  setStages: (stages: Stage[]) => void;
  setConfigData: (id: number, type: keyof FlowStep, values: string[]) => void;
  setAutoProceed: (id: number, values: boolean) => void;
  setSecureDelete: (id: number, value: boolean) => void;
  setKeepDeletionLog: (id: number, value: boolean) => void;
  setIsLockMode: (isLockedMode: boolean) => void;
  setStageProgress: (stageProgress: StageProgress[]) => void;
  setWasResynced: (value: boolean) => void;
  setIsWorkflowData: (isWorkflowData: boolean) => void;
}

export const useAutomateStore = create<AutomateStore>((set) => ({
  taskUniqueId: null,
  taskData: DEFAULT_TASK_DATA,
  workFlowData: DEFAULT_FLOW_STEPS,
  stages: [],
  isLockMode: false,
  filePath: "",
  avFilePath: "",
  stageProgress: [],
  wasResynced: false,
  isWorkflowDataLoaded: false,
  setTaskUniqueId: (id) => set({ taskUniqueId: id }),
  setTaskData: (data) => set({ taskData: data }),
  setWorkFlowData: (data) => set({ workFlowData: data }),
  setStages: (stages) => set({ stages }),
  setFilePath: (filePath) => set({ filePath }),
  setAvFilePath: (avFilePath) => set({ avFilePath }),
  setConfigData: (id, type, values) =>
    set((state) => ({
      workFlowData: state.workFlowData.map((step) =>
        step.id === id
          ? {
              ...step,
              [type]: values,
            }
          : step
      ),
    })),
  setAutoProceed: (id, value) =>
    set((state) => ({
      workFlowData: state.workFlowData.map((step) =>
        step.id === id
          ? {
              ...step,
              auto_proceed: value,
            }
          : step
      ),
    })),
  setSecureDelete: (id, value) =>
    set((state) => ({
      workFlowData: state.workFlowData.map((step) =>
        step.id === id
          ? {
              ...step,
              secureDelete: value,
            }
          : step
      ),
    })),
  setKeepDeletionLog: (id, value) =>
    set((state) => ({
      workFlowData: state.workFlowData.map((step) =>
        step.id === id
          ? {
              ...step,
              keepDeletionLog: value,
            }
          : step
      ),
    })),
  setIsLockMode: (isLockMode) => set({ isLockMode }),
  setStageProgress: (stageProgress) => set({ stageProgress }),
  setWasResynced: (value) => set({ wasResynced: value }),
  setIsWorkflowData: (value) => set({ isWorkflowDataLoaded: value }),
}));

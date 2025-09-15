import { create } from "zustand";
import { ConversionApiResponse } from "@/types/conversion";

export interface ConversionProgress {
  total: number;
  converted: number;
  failed: number;
  currentFile: string;
  size: number;
  phase: number;
  error?: string;
  converted_files: string[];
  failed_files: string[];
}

export interface PhaseProgress {
  phase: number;
  totalFiles: number;
  convertedFiles: number;
  failedFiles: number;
  size: number;
  startTime: string;
  endTime?: string;
  converted_files_list: string[];
  failed_files_list: string[];
}

interface ConversionStoreState {
  selectedFormat: string;
  isConverting: boolean;
  currentPhase: number;
  inputPath: string;
  socketUserId?: string;
  conversionProgress: ConversionProgress | null;
  phases: PhaseProgress[];
  conversionError: string | null;
  apiResponse: ConversionApiResponse | null;
  setSelectedFormat: (format: string) => void;
  setIsConverting: (val: boolean) => void;
  setCurrentPhase: (phase: number) => void;
  setInputPath: (path: string) => void;
  setSocketUserId: (id: string) => void;
  setConversionProgress: (progress: ConversionProgress | null) => void;
  setPhases: (phases: PhaseProgress[]) => void;
  setConversionError: (err: string | null) => void;
  setApiResponse: (resp: ConversionApiResponse | null) => void;
  reset: () => void;
}

export const useConversionStore = create<ConversionStoreState>((set) => ({
  selectedFormat: "eml",
  isConverting: false,
  currentPhase: 1,
  inputPath: "",
  socketUserId: localStorage.getItem("socket_session_id") || undefined,
  conversionProgress: null,
  phases: [],
  conversionError: null,
  apiResponse: null,
  setSelectedFormat: (format) => set({ selectedFormat: format }),
  setIsConverting: (val) => set({ isConverting: val }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setInputPath: (path) => set({ inputPath: path }),
  setSocketUserId: (id) => {
    localStorage.setItem("socket_session_id", id);
    set({ socketUserId: id });
  },
  setConversionProgress: (progress) => set({ conversionProgress: progress }),
  setPhases: (phases) => set({ phases }),
  setConversionError: (err) => set({ conversionError: err }),
  setApiResponse: (resp) => set({ apiResponse: resp }),
  reset: () =>
    set((state) => ({ // Get the current state
      // PRESERVE the user's selection
      selectedFormat: state.selectedFormat, 

      // RESET everything else
      isConverting: false,
      currentPhase: 1,
      socketUserId: localStorage.getItem("socket_session_id") || undefined,
      conversionProgress: null,
      phases: [],
      conversionError: null,
      apiResponse: null,
    })),
}));

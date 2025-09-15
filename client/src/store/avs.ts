import { create } from "zustand";

import { AV } from "@/types";

interface AVStore {
  avs: AV[];
  setAvs: (avs: AV[]) => void;
}

export const useAVStore = create<AVStore>((set) => ({
  avs: [],
  setAvs: (avs) => set({ avs }),
}));

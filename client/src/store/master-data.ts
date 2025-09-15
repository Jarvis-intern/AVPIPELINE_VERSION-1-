import { MasterData } from "@/types/master-data";
import { create } from "zustand";

interface MasterDataStore {
  masterData: MasterData;
  setMasterData: (masterData: MasterData) => void;
}

export const useMasterDataStore = create<MasterDataStore>((set) => ({
  masterData: {
    zip: [],
    conversion: [],
    removal: [],
    verify_removal: [],
    avs: [],
  },
  setMasterData: (masterData: MasterData) => set({ masterData }),
}));

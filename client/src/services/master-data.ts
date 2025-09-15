import { api } from "@/lib/api";
import { MasterData } from "@/types/master-data";

export const MasterDataService = {
  async getMasterData(): Promise<MasterData> {
    const response = await api.get<MasterData>("/api/master-data/");
    return response;
  },
};

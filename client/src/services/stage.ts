import { API_URL } from "@/constants/api";
import { Stage } from "@/types/automate";

export const StageService = {
    getAllStages: async (): Promise<Stage[]> => {
        const response = await fetch(`${API_URL}/api/stage/all`);
        const data = await response.json();
        return data;
    }
}



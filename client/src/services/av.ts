import { API_URL } from "@/constants/api";
import { AV } from "@/types";

export const AVService = {
  async getAVs(): Promise<AV[]> {
    const response = await fetch(`${API_URL}/api/av/`);
    if (!response.ok) {
      throw new Error("Failed to fetch AV");
    }

    const avs = await response.json();
    return avs;
  },

  async getAV(id: string): Promise<AV> {
    const response = await fetch(`${API_URL}/api/av/${id}`);

    if (!response.ok) {
      throw new Error("Failed to fetch AV");
    }

    const av = await response.json();
    return av;
  },

  async createAV(avData: Omit<AV, "id">): Promise<AV> {
    const response = await fetch(`${API_URL}/api/av/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(avData),
    });

    if (!response.ok) throw new Error("Failed to create AV");

    const newAv = await response.json();
    return newAv;
  },

  async updateAV(id: string, avData: Partial<AV>): Promise<AV> {
    const response = await fetch(`${API_URL}/api/av/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(avData),
    });

    if (!response.ok) throw new Error("Failed to update AV");

    const updatedAv = await response.json();
    return updatedAv;
  },

  async deleteAV(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/av/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Failed to delete AV");
  },
};

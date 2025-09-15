import { API_URL } from "@/constants/api";

export const getIpAddress = async () => {
  const response = await fetch(`${API_URL}/api/system-info/ip-address`);
  const data: { ip_address: string } = await response.json();
  return data.ip_address;
};

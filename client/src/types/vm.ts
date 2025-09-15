export interface VM {
    id: string;
    name: string;
    status: "active" | "inactive" | "maintenance";
    ipAddress: string;
    user: string;
    avInstalled: string[];
    lastScan: string;
  }
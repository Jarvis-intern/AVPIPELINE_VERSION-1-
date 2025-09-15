import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AV } from "@/types/";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ScanFormProps {
  avs: AV[];
  selectedAV: AV | null;
  onAVSelect: (av: AV | null) => void;
  scanPath: string;
  onPathChange: (path: string) => void;
  scanType: "quick" | "full";
  onScanTypeChange: (type: "quick" | "full") => void;
  onScan: () => void;
  isScanning: boolean;
}

const ScanForm: React.FC<ScanFormProps> = ({
  avs,
  selectedAV,
  onAVSelect,
  scanPath,
  onPathChange,
  onScan,
  isScanning,
}) => {
  const handleAVChange = (value: string) => {
    const av = avs.find((a) => a.id?.toString() === value);
    onAVSelect(av || null);
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <Label htmlFor="av-select">Select AV Engine</Label>
          <Select
            value={selectedAV ? selectedAV.id?.toString() : ""}
            onValueChange={handleAVChange}
            disabled={isScanning}
          >
            <SelectTrigger id="av-select">
              <SelectValue placeholder="Select an AV engine" />
            </SelectTrigger>
            <SelectContent>
              {avs.map((av) => (
                <SelectItem key={av.id} value={av.id?.toString() || ""}>
                  {av.name} ({av.ip_address})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scan-path">Path to Scan</Label>
          <Input
            id="scan-path"
            value={scanPath}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onPathChange(e.target.value)
            }
            placeholder="Enter path to scan (e.g., C:\\Windows)"
            disabled={isScanning}
          />
        </div>

        <Button
          onClick={onScan}
          disabled={isScanning || !selectedAV || !scanPath}
          className="w-full"
        >
          {isScanning ? "Scanning..." : "Start Scan"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ScanForm;

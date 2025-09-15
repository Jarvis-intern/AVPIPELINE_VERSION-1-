import { toast } from "sonner";
import { useState, useEffect, useCallback, useRef } from "react";

import ScanForm from "./_components/scan-form";
import { ScanLogs } from "./_components/scan-logs";
import { ScanResultsCard } from "./_components/scan-result-card";

import {
  clamAVParser,
  emsiAVParser,
  esetAVParser,
  avastAVParser,
  comodoAVParser,
  sophosAVParser,
  fSecureAVParser,
  kasperskyAVParser,
  windowsDefenderAVParser,
  avgParser,
} from "@/lib/parser";
import { AVService } from "@/services/av";
import { AV, AVParsedResult } from "@/types";
import { ScanLog } from "@/proto/av_scanner";
import socket from "@/lib/socket";

const UPDATE_INTERVAL_MS = 2000; // Update every 2 seconds for real-time feel
const MAX_LOGS = 20000; // Lower limit since it's single scan
const PARSE_THROTTLE_MS = 500; // Faster parsing throttle for real-time feedback

export function ScanPage() {
  const [avs, setAvs] = useState<AV[]>([]);
  const [selectedAV, setSelectedAV] = useState<AV | null>(null);
  const [scanPath, setScanPath] = useState("Z:");
  const [scanType, setScanType] = useState<"quick" | "full">("quick");
  const [isScanning, setIsScanning] = useState(false);
  const [parsedResult, setParsedResult] = useState<AVParsedResult>();
  const [scanStartTime, setScanStartTime] = useState<string | undefined>(
    undefined
  );
  const [scanEndTime, setScanEndTime] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<ScanLog[]>([]);

  // Refs for accumulated data and performance optimization
  const fullLogRef = useRef<string>("");
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastParseTimeRef = useRef<number>(0);

  // Parser function
  const parseLogs = useCallback((logContent: string, avName: string) => {
    let parsedContent: AVParsedResult = {
      totalScannedFiles: [],
      infectedFiles: [],
      errorFiles: [],
    };

    switch (avName.toLowerCase().split(" ").join("-")) {
      case "clam-av":
        parsedContent = clamAVParser(logContent);
        break;
      case "eset":
        parsedContent = esetAVParser(logContent);
        break;
      case "kaspersky":
        parsedContent = kasperskyAVParser(logContent);
        break;
      case "emsi":
        parsedContent = emsiAVParser(logContent);
        break;
      case "comodo":
        parsedContent = comodoAVParser(logContent);
        break;
      case "avast":
        parsedContent = avastAVParser(logContent);
        break;
      case "windows-defender":
        parsedContent = windowsDefenderAVParser(logContent);
        break;
      case "sophos":
        parsedContent = sophosAVParser(logContent);
        break;
      case "fsecure":
        parsedContent = fSecureAVParser(logContent);
        break;
      case "avg":
        parsedContent = avgParser(logContent);
        break;
      default:
        toast.error("Incorrect AV");
    }

    return parsedContent;
  }, []);

  // Throttled parsing function
  const throttledParse = useCallback(() => {
    if (!selectedAV || !fullLogRef.current) return;

    const now = Date.now();
    const lastParse = lastParseTimeRef.current;

    if (now - lastParse < PARSE_THROTTLE_MS) {
      // Clear existing timeout and set new one
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }

      parseTimeoutRef.current = setTimeout(() => {
        if (selectedAV && fullLogRef.current) {
          const parsedContent = parseLogs(fullLogRef.current, selectedAV.name);
          setParsedResult(parsedContent);
          lastParseTimeRef.current = Date.now();
        }
      }, PARSE_THROTTLE_MS - (now - lastParse));
    } else {
      // Parse immediately
      const parsedContent = parseLogs(fullLogRef.current, selectedAV.name);
      setParsedResult(parsedContent);
      lastParseTimeRef.current = now;
    }
  }, [selectedAV, parseLogs]);

  // Periodic parsing function
  const periodicParse = useCallback(() => {
    if (selectedAV && fullLogRef.current) {
      const parsedContent = parseLogs(fullLogRef.current, selectedAV.name);
      setParsedResult(parsedContent);
    }
  }, [selectedAV, parseLogs]);

  useEffect(() => {
    // Fetch AV engines on component mount
    AVService.getAVs()
      .then((data) => setAvs(data))
      .catch((_) => setError("Failed to fetch AV engines"));
  }, []);

  useEffect(() => {
    // Listen for logs and scan complete from backend
    const handleLog = (log: any) => {
      // Convert to ScanLog type if needed
      setLogs((prev) => {
        const updated = [...prev, log];
        if (updated.length > MAX_LOGS) return updated.slice(-MAX_LOGS);
        return updated;
      });
      fullLogRef.current += (log.content || "") + "\n";
      throttledParse();
    };
    const handleComplete = () => {
      setIsScanning(false);
      setScanEndTime(new Date().toISOString());
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
        parseTimeoutRef.current = null;
      }
      // Final parse
      if (selectedAV && fullLogRef.current) {
        const parsedContent = parseLogs(fullLogRef.current, selectedAV.name);
        setParsedResult(parsedContent);
      }
    };

    const handleError = (data: any) => {
      setIsScanning(false);
      console.error(data.error);
      toast.error(data.error);
    };

    socket.on("av_scan_log", handleLog);
    socket.on("av_scan_error", handleError);
    socket.on("av_scan_complete", handleComplete);
    return () => {
      socket.off("av_scan_log", handleLog);
      socket.off("av_scan_error", handleError);
      socket.off("av_scan_complete", handleComplete);
    };
  }, [selectedAV, throttledParse, parseLogs]);

  const handleScan = async () => {
    if (!selectedAV || !scanPath) return;

    setIsScanning(true);
    setError(null);
    setLogs([]);
    setParsedResult(undefined);
    fullLogRef.current = "";
    lastParseTimeRef.current = 0;
    setScanStartTime(new Date().toISOString());
    setScanEndTime(undefined);

    // Start periodic parsing
    updateIntervalRef.current = setInterval(periodicParse, UPDATE_INTERVAL_MS);

    // Emit event to backend to start scanning
    socket.emit("start_scanning", {
      scanning_id: Date.now().toString(),
      scan_path: scanPath,
      av_id: selectedAV.id,
    });
  };

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (parseTimeoutRef.current) {
        clearTimeout(parseTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">AV Scan</h2>

        <ScanForm
          avs={avs}
          selectedAV={selectedAV}
          onAVSelect={setSelectedAV}
          scanPath={scanPath}
          onPathChange={setScanPath}
          scanType={scanType}
          onScanTypeChange={setScanType}
          onScan={handleScan}
          isScanning={isScanning}
        />

        {error && (
          <div className="text-red-500 p-4 bg-red-50 rounded-md border border-red-300">
            {error}
          </div>
        )}

        {logs.length > 0 && selectedAV && (
          <ScanLogs av={selectedAV} logs={logs || []} />
        )}

        {parsedResult && (
          <ScanResultsCard
            result={parsedResult}
            isScanning={isScanning}
            scanStartTime={scanStartTime}
            scanEndTime={scanEndTime}
          />
        )}
      </div>
    </div>
  );
}

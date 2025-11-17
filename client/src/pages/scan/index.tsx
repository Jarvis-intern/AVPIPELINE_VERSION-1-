import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect, useRef, useMemo } from "react";

import ScanForm from "./_components/scan-form";
import { ScanLogs } from "./_components/scan-logs";
import { ScanResultsCard } from "./_components/scan-result-card";

import {
  clamAVParser,
  emsiAVParser,
  esetAVParser,
  avastAVParser,
  comodoAVParser,
  // sophosAVParser, // Unused for now
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

// Add a tiny generic fallback parser (very permissive)
function genericAVParser(log: string): AVParsedResult {
  const lines = log.split("\n").map((l) => l.trim()).filter(Boolean);
  const totalScannedFiles: string[] = [];
  const infectedFiles: { filePath: string; virusName: string; threatName?: string }[] = [];
  const errorFiles: { filePath: string; errorMesg: string }[] = [];
  for (const line of lines) {
    const content = line.includes("|") ? line.split("|")[1].trim() : line;
    if (!content) continue;
    const fileMatch = content.match(/([A-Za-z]:[\\/].+|\\\\[^\\]+\\.+)/);
    const filePath = fileMatch?.[1];
    if (!filePath) continue;
    if (/infect|found|threat|virus/i.test(content)) {
      const threatName = content.replace(filePath, "").trim();
      infectedFiles.push({ filePath, virusName: threatName || "Unknown", threatName });
    } else if (/err|fail|denied/i.test(content)) {
      errorFiles.push({ filePath, errorMesg: content.replace(filePath, "").trim() });
    } else {
      if (!totalScannedFiles.includes(filePath)) totalScannedFiles.push(filePath);
    }
  }
  return { totalScannedFiles, infectedFiles, errorFiles };
}

// Replace the useCallback version with a plain function
function parseLogs(logContent: string, avName: string): AVParsedResult {
  const norm = avName.toLowerCase().replace(/\s+/g, "-");
  const alias: Record<string, (s: string) => AVParsedResult> = {
    "clam-av": clamAVParser,
    "clamav": clamAVParser,
    "eset": esetAVParser,
    "kaspersky": kasperskyAVParser,
    "emsi": emsiAVParser,
    "emsisoft": emsiAVParser,
    "comodo": comodoAVParser,
    "avast": avastAVParser,
    "windows-defender": windowsDefenderAVParser,
    "microsoft-defender": windowsDefenderAVParser,
    "fsecure": fSecureAVParser,
    "f-secure": fSecureAVParser,
    "avg": avgParser,
  };
  const parser = alias[norm] || genericAVParser;
  return parser(logContent);
}

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
  const [organizing, setOrganizing] = useState(false);
  const [organized, setOrganized] = useState(false);
  const [organizeMessages, setOrganizeMessages] = useState<Array<{
    action: string;
    file: string;
    message: string;
    error?: string;
  }>>([]);

  // Refs for accumulated data and performance optimization
  const fullLogRef = useRef<string>("");
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const parseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastParseTimeRef = useRef<number>(0);

  // Throttled parsing function
  const throttledParse = useMemo(() => {
    return () => {
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
    };
  }, [selectedAV, parseLogs]);

  // Periodic parsing function
  const periodicParse = useMemo(() => {
    return () => {
      if (selectedAV && fullLogRef.current) {
        const parsedContent = parseLogs(fullLogRef.current, selectedAV.name);
        setParsedResult(parsedContent);
      }
    };
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

  // Reset organize state when a new scan starts or AV changes
  useEffect(() => {
    setOrganizing(false);
    setOrganized(false);
    setOrganizeMessages([]);
  }, [selectedAV, scanPath, isScanning]);

  // Listen for organize events (reuse backend handlers)
  useEffect(() => {
    const handleDone = () => {
      setOrganizing(false);
      setOrganized(true);
      toast.success("Files organized successfully!");
    };
    const handleError = (data: any) => {
      setOrganizing(false);
      toast.error(data.error || "Failed to organize files");
    };
    const handleProgress = (data: any) => {
      setOrganizeMessages((prev) => [...prev, data]);
      if (data.action === "moved") {
        toast.success(data.message);
      } else if (data.action === "error") {
        toast.error(data.message);
      }
    };
    socket.on("organize_av_results_complete", handleDone);
    socket.on("organize_av_results_error", handleError);
    socket.on("organize_progress", handleProgress);
    return () => {
      socket.off("organize_av_results_complete", handleDone);
      socket.off("organize_av_results_error", handleError);
      socket.off("organize_progress", handleProgress);
    };
  }, []);

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

  const handleOrganize = () => {
    if (!parsedResult || parsedResult.infectedFiles.length === 0) {
      toast.error("No infected files to organize.");
      return;
    }
    if (!selectedAV) {
      toast.error("Select an AV engine first.");
      return;
    }
    // Prepare unique infected file paths (deduplicate)
    const infected = Array.from(
      new Set(parsedResult.infectedFiles.map((f) => f.filePath))
    );
    if (infected.length === 0) {
      toast.error("No infected files detected.");
      return;
    }
    setOrganizing(true);
    setOrganizeMessages([]);
    socket.emit("organize_av_results", {
      filePath: scanPath,
      infectedFiles: infected,
      avName: selectedAV.name,
      task_id: "", // no task context for ad-hoc scans
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
          <>
            <ScanResultsCard
              result={parsedResult}
              isScanning={isScanning}
              scanStartTime={scanStartTime}
              scanEndTime={scanEndTime}
            />

            <div className="mt-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Button
                  variant="default"
                  onClick={handleOrganize}
                  disabled={
                    isScanning ||
                    organizing ||
                    organized ||
                    parsedResult.infectedFiles.length === 0
                  }
                >
                  {organizing
                    ? "Organizing..."
                    : organized
                    ? "Organized"
                    : parsedResult.infectedFiles.length === 0
                    ? "No Infected Files"
                    : "Organize Files"}
                </Button>
                {!organized && !organizing && (
                  <span className="text-xs text-muted-foreground">
                    {parsedResult.infectedFiles.length === 0
                      ? "Scan found no infected files."
                      : "Moves infected files into an 'infected' folder beside the scanned path."}
                  </span>
                )}
              </div>
              
              {organizing && (
                <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <span className="animate-spin">🔄</span>
                    Organizing infected files...
                  </div>
                  {organizeMessages.length > 0 && (
                    <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                      {organizeMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-2 rounded ${
                            msg.action === "moved"
                              ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                              : msg.action === "error"
                              ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                              : "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                          }`}
                        >
                          {msg.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {organized && (
                <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                    ✓ Files organized successfully!
                  </div>
                  {organizeMessages.length > 0 && (
                    <div className="text-xs text-green-600 dark:text-green-400">
                      {organizeMessages.filter(m => m.action === "moved").length} files moved to quarantine
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Check the 'infected' folder in your scan directory.
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

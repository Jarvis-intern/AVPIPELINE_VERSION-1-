import { toast } from "sonner";
import { Shield } from "lucide-react";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";

import { ProgressHeader } from "../_components/progress-header";

import {
  clamAVParser,
  emsiAVParser,
  esetAVParser,
  avastAVParser,
  sophosAVParser,
  comodoAVParser,
  fSecureAVParser,
  kasperskyAVParser,
  windowsDefenderAVParser,
  avgParser,
} from "@/lib/parser";
import socket from "@/lib/socket";
import { useAVStore } from "@/store/avs";
import { AV, AVParsedResult } from "@/types";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { useAutomateStore } from "@/store/automate";
import { FlowStepType, ScanLog, StageStatus } from "@/types/automate";
import { ScanLogs } from "@/pages/scan/_components/scan-logs";
import { ScanResultsCard } from "@/pages/scan/_components/scan-result-card";

const PARSE_THROTTLE_MS = 1000;

export const AvScanStage = () => {
  const { stageProgress, wasResynced, filePath, taskUniqueId, workFlowData } =
    useAutomateStore();
  const { avs } = useAVStore();
  const [avLogs, setAvLogs] = useState<{ [key: string]: ScanLog[] }>({});
  const [avParsedResults, setAvParsedResults] = useState<{
    [key: string]: AVParsedResult;
  }>({});
  const [completedScans, setCompletedScans] = useState<Set<string>>(new Set());
  const [organizing, setOrganizing] = useState(false);
  const [organizeMessages, setOrganizeMessages] = useState<Array<{
    action: string;
    file: string;
    message: string;
    error?: string;
  }>>([]);

  const avScanProgress = useMemo(
    () => stageProgress.find((stage) => stage.type === FlowStepType.AV_SCAN),
    [stageProgress]
  );

  useEffect(() => {
    if (avScanProgress) {
      let tempAvLogs: { [key: string]: ScanLog[] } = {};
      let tempParsedResuts: { [key: string]: AVParsedResult } = {};
      for (const avLogs of avScanProgress.avScanData) {
        tempAvLogs[avLogs.avName] = avLogs.scanLogs;
        tempParsedResuts[avLogs.avName] = parseLogs(
          avLogs.scanLogs.map((l) => l.content).join("\n"),
          avLogs.avName
        );
      }
      setAvLogs(tempAvLogs);
      setAvParsedResults(tempParsedResuts);
      setCompletedScans(
        new Set(
          avScanProgress.avScanData
            .filter((a) => a.status === "DONE")
            .map((a) => a.avName)
        )
      );
    }
  }, [wasResynced]);

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
    }
    return parsedContent;
  }, []);

  // Store full logs per AV for parsing
  const fullLogsRef = useRef<{ [key: string]: string }>({});
  const parseTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({});
  const lastParseTimeRef = useRef<{ [key: string]: number }>({});

  // Throttled parsing per AV
  const throttledParse = useCallback(
    (avName: string) => {
      const now = Date.now();
      const lastParse = lastParseTimeRef.current[avName] || 0;
      if (now - lastParse < PARSE_THROTTLE_MS) {
        if (parseTimeoutRef.current[avName]) {
          clearTimeout(parseTimeoutRef.current[avName]!);
        }
        parseTimeoutRef.current[avName] = setTimeout(() => {
          if (fullLogsRef.current[avName]) {
            const parsedContent = parseLogs(
              fullLogsRef.current[avName],
              avName
            );
            setAvParsedResults((prev) => ({
              ...prev,
              [avName]: parsedContent,
            }));
            lastParseTimeRef.current[avName] = Date.now();
          }
        }, PARSE_THROTTLE_MS - (now - lastParse));
      } else {
        if (fullLogsRef.current[avName]) {
          const parsedContent = parseLogs(fullLogsRef.current[avName], avName);
          setAvParsedResults((prev) => ({ ...prev, [avName]: parsedContent }));
          lastParseTimeRef.current[avName] = now;
        }
      }
    },
    [parseLogs]
  );

  // Listen for logs and scan complete from backend
  useEffect(() => {
    const handleLog = (log: any) => {
      const avId = log.av_id?.toString();
      const avName = log.av_name;
      if (!avId || !avName) return;
      setAvLogs((prev) => ({
        ...prev,
        [avId]: [...(prev[avId] || []), log],
      }));
      if (!fullLogsRef.current[avName]) fullLogsRef.current[avName] = "";
      fullLogsRef.current[avName] += (log.content || "") + "\n";
      throttledParse(avName);
    };
    const handleComplete = () => {
      setCompletedScans((prev) => {
        // Only add string ids, filter out undefined
        const allAvIds = avs
          .map((av) => (av.id !== undefined ? String(av.id) : av.name))
          .filter((id): id is string => !!id);
        return new Set([...Array.from(prev), ...allAvIds]);
      });
    };
    // Listen for per-AV scan done event
    const handleAvScanDone = (data: any) => {
      if (data && data.avName) {
        setCompletedScans(
          (prev) => new Set([...Array.from(prev), data.avName])
        );
      }
    };
    socket.on("av_scan_log", handleLog);
    socket.on("av_scan_complete", handleComplete);
    socket.on("av_scan_done", handleAvScanDone);
    return () => {
      socket.off("av_scan_log", handleLog);
      socket.off("av_scan_complete", handleComplete);
      socket.off("av_scan_done", handleAvScanDone);
    };
  }, [avs, throttledParse]);

  // Listen for organize events
  useEffect(() => {
    const handleDone = () => {
      setOrganizing(false);
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.AV_SCAN
            ? { ...stage, isOrganized: true }
            : stage
        ),
        workFlowData: state.workFlowData.map((stage) =>
          stage.type === FlowStepType.AV_SCAN
            ? { ...stage, isOrganized: true }
            : stage
        ),
      }));
      toast.success("Files organized successfully!");
    };
    const handleError = (data: any) => {
      setOrganizing(false);
      toast.error(data.error);
    };
    const handleProgress = (data: any) => {
      setOrganizeMessages((prev) => [...prev, data]);
      if (data.action === "moved") {
        toast.success(data.message);
      } else if (data.action === "error") {
        toast.error(data.message);
      }
    };

    socket.on("organize_av_results_error", handleError);
    socket.on("organize_av_results_complete", handleDone);
    socket.on("organize_progress", handleProgress);
    return () => {
      socket.off("organize_av_results_error", handleError);
      socket.off("organize_av_results_complete", handleDone);
      socket.off("organize_progress", handleProgress);
    };
  }, []);

  // Organize handler (all AVs)
  const handleOrganizeAll = () => {
    // Collect all infected files from all AVs
    let allInfectedFiles: string[] = [];
    Object.entries(avParsedResults).forEach(([_, avLog]) => {
      allInfectedFiles = allInfectedFiles.concat(
        avLog.infectedFiles.map((i) => i.filePath)
      );
    });
    setOrganizing(true);
    setOrganizeMessages([]);
    socket.emit("organize_av_results", {
      filePath,
      infectedFiles: allInfectedFiles,
      avName: "all",
      task_id: taskUniqueId,
    });
  };

  if (!avScanProgress) return null;

  // Explicitly type avScanData
  const avScanData = avScanProgress.avScanData;

  // Remove setOrganized and setOrganizing, and always render from the store
  const isOrganized =
    workFlowData.find((f) => f.type === FlowStepType.AV_SCAN)?.isOrganized ||
    avScanProgress?.isOrganized ||
    false;

  return (
    <CardContent>
      <ProgressHeader
        stageNumber={6}
        stageTitle="AV Scan"
        status={avScanProgress.status}
      />

      <div className="mt-4 space-y-4">
        <div className="flex items-start gap-2">
          <div className="text-muted-foreground text-sm min-w-24">
            AV Engine:
          </div>
          <div className="flex items-center flex-1 h-7 bg-muted rounded-md">
            <Shield className="size-4 mx-2 text-muted-foreground" />
            <div className="truncate text-xs w-full">
              {avScanProgress.status === StageStatus.ERROR ? (
                <span className="text-red-600">
                  {avScanProgress.message || "Error during AV scan"}
                </span>
              ) : (
                (avScanProgress?.avScanData &&
                  avScanProgress.avScanData
                    .map((av: any) => av.avName)
                    .join(", ")) ||
                "No AV engines configured"
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-y-4">
          {avScanData &&
            avScanData.map((av) => {
              const avName = av.avName;
              return (
                <div
                  key={av.avName}
                  className="space-y-4 border rounded-lg p-4"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="size-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm">{av.avName}</h3>
                  </div>
                  <ScanLogs
                    av={{ name: av.avName } as AV}
                    logs={avLogs[av.avName] || []}
                  />
                  {avParsedResults[avName] && (
                    <ScanResultsCard
                      result={avParsedResults[avName]}
                      isScanning={!completedScans.has(av.avName)}
                      scanStartTime={av.startTime}
                      scanEndTime={av.endTime}
                    />
                  )}
                </div>
              );
            })}
          {!isOrganized && (
            <Button
              disabled={
                organizing || avScanProgress.status === StageStatus.PENDING
              }
              onClick={handleOrganizeAll}
            >
              {organizing ? (
                <span>
                  <span className="animate-spin mr-2">🔄</span>
                  Organizing All Files...
                </span>
              ) : isOrganized ? (
                "Organized!"
              ) : (
                "Organize All Files"
              )}
            </Button>
          )}
          {organizing && (
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <span className="animate-spin">🔄</span>
                Organizing files for all AVs...
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
          {isOrganized && organizeMessages.length > 0 && (
            <div className="space-y-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                ✓ Files organized successfully!
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {organizeMessages.filter(m => m.action === "moved").length} files moved to quarantine
              </div>
            </div>
          )}
          {isOrganized && (
            <div className="text-sm text-green-600 mt-2 flex items-center gap-2">
              Files organized for all AVs!
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.clear();
                  window.location.href = "/";
                }}
                className="ml-2"
              >
                Go to Home
              </Button>
            </div>
          )}
        </div>
      </div>
    </CardContent>
  );
};

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
    };
    const handleError = (data: any) => {
      toast.error(data.error);
    };

    socket.on("organize_av_results_error", handleError);
    socket.on("organize_av_results_complete", handleDone);
    return () => {
      socket.off("organize_av_results_error", handleError);
      socket.off("organize_av_results_complete", handleDone);
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
            <div className="text-sm text-blue-500 mt-2">
              Organizing files for all AVs...
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

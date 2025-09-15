import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  FolderOpen,
} from "lucide-react";
import { useState, useEffect } from "react";

import { ProgressHeader } from "../_components/progress-header";
import { StageProgress } from "../_components/stage-progress";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import socket from "@/lib/socket";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { useAutomateStore } from "@/store/automate";
import { FlowStepType, StageStatus } from "@/types/automate";

interface ConversionTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  convertedFiles: number;
  failedFiles: number;
  convertedFilesList: string[];
  failedFilesList: string[];
  currentPhase: number;
  error?: string;
}

export const ConversionStage = () => {
  const { stageProgress, taskUniqueId } = useAutomateStore();
  const [currentConversionIndex, setCurrentConversionIndex] = useState(0);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const conversionProgress = stageProgress.find(
    (stage) => stage.type === FlowStepType.CONVERSION
  );

  const conversionResults = conversionProgress?.conversionResults || [];

  useEffect(() => {
    if (!taskUniqueId) return;

    const handleConversionStarted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const conversionType = data.conversion_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.CONVERSION
            ? {
                ...stage,
                conversionResults: (stage.conversionResults || []).map(
                  (result) =>
                    result.type === conversionType
                      ? { ...result, status: "running", currentPhase: 1 }
                      : result
                ),
              }
            : stage
        ),
      }));
      // Auto-expand the currently running conversion type
      if (conversionType) {
        setExpandedTypes((prev) => new Set([...prev, conversionType]));
      }
    };

    const handleFileProgress = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const conversionType = data.conversion_type;

      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.CONVERSION
            ? {
                ...stage,
                currConversionType: conversionType,
                currentFile: data.current_file,
                phase: data.phase,
                currFileNumber: data.converted_count,
                filesCount: data.total_files,
                conversionResults: (stage.conversionResults || []).map(
                  (result) =>
                    result.type === conversionType
                      ? {
                          ...result,
                          convertedFiles: data.converted_count || 0,
                          failedFiles: data.failed_count || 0,
                          totalFiles: data.total_files || 0,
                          convertedFilesList: data.converted_files || [],
                          failedFilesList: data.failed_files || [],
                        }
                      : result
                ),
              }
            : stage
        ),
      }));
    };

    const handleConversionTypeCompleted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const conversionType = data.conversion_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.CONVERSION
            ? {
                ...stage,
                conversionResults: (stage.conversionResults || []).map(
                  (result) =>
                    result.type === conversionType
                      ? {
                          ...result,
                          status: "completed",
                          convertedFiles: data.total_converted || 0,
                          failedFiles: data.total_failed || 0,
                          convertedFilesList: data.converted_files || [],
                          failedFilesList: data.failed_files || [],
                        }
                      : result
                ),
              }
            : stage
        ),
      }));
      setCurrentConversionIndex((prev) => prev + 1);
    };

    const handleConversionError = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const conversionType = data.conversion_type;
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.CONVERSION
            ? {
                ...stage,
                conversionResults: (stage.conversionResults || []).map(
                  (result) =>
                    result.type === conversionType
                      ? {
                          ...result,
                          status: "error",
                          error: data.error || "Unknown error occurred",
                        }
                      : result
                ),
                status: StageStatus.ERROR,
                message: data.error || "Error during conversion",
              }
            : stage
        ),
      }));
    };

    // Register socket event listeners
    socket.on("conversion_started", handleConversionStarted);
    socket.on("file_progress", handleFileProgress);
    socket.on("conversion_type_complete", handleConversionTypeCompleted);
    socket.on("conversion_error", handleConversionError);

    // Cleanup function
    return () => {
      socket.off("conversion_started", handleConversionStarted);
      socket.off("file_progress", handleFileProgress);
      socket.off("conversion_type_complete", handleConversionTypeCompleted);
      socket.off("conversion_error", handleConversionError);
    };
  }, [taskUniqueId]);

  const toggleExpanded = (type: string) => {
    setExpandedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: ConversionTypeResult["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: ConversionTypeResult["status"]) => {
    switch (status) {
      case "completed":
        return <Badge variant="success">Completed</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "running":
        return <Badge variant="default">Running</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (!conversionProgress) return null;

  const currentResult = conversionResults[currentConversionIndex];

  return (
    <CardContent className="border-b border-slate-100 pb-6">
      <ProgressHeader
        stageNumber={2}
        stageTitle="Conversion"
        status={conversionProgress.status}
      />

      <div className="mt-4 space-y-4">
        {/* Overall Progress */}
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground text-sm min-w-24">
            Overall Progress:
          </div>
          <div className="flex items-center flex-1 h-7 bg-muted rounded-md">
            <FileText className="size-4 mx-2 text-muted-foreground" />
            <div className="truncate text-xs w-full px-2">
              {conversionProgress.status === StageStatus.ERROR ? (
                <span className="text-red-600">
                  {conversionProgress.message || "Error during conversion"}
                </span>
              ) : (
                `${
                  conversionResults.filter((c) => c.status === "completed")
                    .length
                }/${conversionResults.length} conversion types completed`
              )}
            </div>
          </div>
        </div>

        {/* Current File Progress */}
        {currentResult && currentResult.status === "running" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-3">
              Currently Converting: {currentResult.type}
            </h4>

            <div className="space-y-3">
              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Current File:</div>
                <div className="font-medium flex-1 truncate text-blue-900">
                  {conversionProgress.currentFile || "Initializing..."}
                </div>
              </div>

              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Progress:</div>
                <div className="font-medium text-blue-900">
                  {conversionProgress.currFileNumber || 0} of{" "}
                  {conversionProgress.filesCount || 0} files
                </div>
              </div>

              <StageProgress
                current={conversionProgress.currFileNumber || 0}
                total={conversionProgress.filesCount || 0}
                status={conversionProgress.status}
              />

              {/* Live file conversion status */}
              {conversionProgress.currentFile && (
                <div className="mt-3 p-3 bg-white border border-blue-200 rounded">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-blue-800 font-medium">
                      Converting:{" "}
                      {conversionProgress.currentFile.split("/").pop() ||
                        conversionProgress.currentFile}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-blue-600">
                    {currentResult.convertedFiles > 0 && (
                      <span>{currentResult.convertedFiles} converted</span>
                    )}
                    {currentResult.failedFiles > 0 && (
                      <span className="ml-2 text-red-600">
                        {currentResult.failedFiles} failed
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conversion Types Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">
            Conversion Results
          </h4>
          {conversionResults.map((result, index) => (
            <div key={result.type} className="border rounded-lg p-3 bg-white">
              <Collapsible
                open={expandedTypes.has(result.type)}
                onOpenChange={() => toggleExpanded(result.type)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.type}</span>
                    {getStatusBadge(result.status)}
                    {index === currentConversionIndex &&
                      result.status === "running" && (
                        <Badge
                          variant="outline"
                          className="text-xs animate-pulse"
                        >
                          Current
                        </Badge>
                      )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {result.status === "running" && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-blue-600">
                          {result.convertedFiles}/{result.totalFiles} files
                        </span>
                      </div>
                    )}
                    {result.status !== "pending" &&
                      result.status !== "running" && (
                        <span>
                          {result.convertedFiles} converted,{" "}
                          {result.failedFiles} failed
                        </span>
                      )}
                    <FolderOpen className="h-4 w-4" />
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent className="mt-3 space-y-2">
                  {result.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Error: {result.error}
                    </div>
                  )}

                  {/* Live progress for running conversion */}
                  {result.status === "running" &&
                    index === currentConversionIndex &&
                    conversionProgress.currentFile && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="text-sm font-medium text-blue-900">
                            Live Progress
                          </span>
                        </div>
                        <div className="text-xs text-blue-800 mb-1">
                          Currently processing:{" "}
                          {conversionProgress.currentFile.split("/").pop() ||
                            conversionProgress.currentFile}
                        </div>
                        <div className="text-xs text-blue-600">
                          Phase {result.currentPhase} • {result.convertedFiles}{" "}
                          of {result.totalFiles} files processed
                        </div>
                      </div>
                    )}

                  {result.status !== "pending" && (
                    <>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">
                            Total Files:
                          </span>
                          <div className="font-medium">{result.totalFiles}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Converted:
                          </span>
                          <div className="font-medium text-green-600">
                            {result.convertedFiles}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Failed:</span>
                          <div className="font-medium text-red-600">
                            {result.failedFiles}
                          </div>
                        </div>
                      </div>

                      {result.convertedFilesList.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-green-700 mb-2">
                            Converted Files ({result.convertedFilesList.length})
                          </h5>
                          <div className="max-h-32 overflow-y-auto bg-green-50 p-2 rounded text-xs">
                            {result.convertedFilesList.map((file, idx) => (
                              <div
                                key={idx}
                                className="truncate text-green-800"
                              >
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.failedFilesList.length > 0 && (
                        <div>
                          <h5 className="text-sm font-medium text-red-700 mb-2">
                            Failed Files ({result.failedFilesList.length})
                          </h5>
                          <div className="max-h-32 overflow-y-auto bg-red-50 p-2 rounded text-xs">
                            {result.failedFilesList.map((file, idx) => (
                              <div key={idx} className="truncate text-red-800">
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  );
};

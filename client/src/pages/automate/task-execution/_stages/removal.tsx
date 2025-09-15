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

interface RemovalTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  removedFiles: number;
  failedFiles: number;
  removedFilesList: string[];
  failedFilesList: string[];
  error?: string;
}

export const RemovalStage = () => {
  const { stageProgress, taskUniqueId } = useAutomateStore();
  const [currentRemovalIndex, setCurrentRemovalIndex] = useState(0);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const removalProgress = stageProgress.find(
    (stage) => stage.type === FlowStepType.REMOVAL
  );

  const removalResults = removalProgress?.removalResults || [];
  // Separate useEffect for socket listeners

  useEffect(() => {
    if (!taskUniqueId) return;

    const handleRemovalStarted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      // const removalType = data.removal_type.toUpperCase();
      // console.log(removalType)
      // useAutomateStore.setState((state) => ({
      //   stageProgress: state.stageProgress.map((stage) =>
      //     stage.type === FlowStepType.REMOVAL
      //       ? {
      //           ...stage,
      //           removalResults: (stage.removalResults || []).map((result) =>
      //             result.type === removalType
      //               ? { ...result, status: "running" }
      //               : result
      //           ),
      //         }
      //       : stage
      //   ),
      // }));
      // if (removalType) {
      //   setExpandedTypes((prev) => new Set([...prev, removalType]));
      // }
    };

    const handleRemovalTypeStarted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const removalType = data.removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.REMOVAL
            ? {
                ...stage,
                removalResults: (stage.removalResults || []).map((result) =>
                  result.type === removalType
                    ? {
                        ...result,
                        totalFiles: data.curr_type_files || 0,
                        removedFiles: data.total_removal_files,
                        failedFiles: 0,
                        removedFilesList: [],
                        failedFilesList: [],
                      }
                    : result
                ),
              }
            : stage
        ),
      }));
    };

    const handleRemovalProgress = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const removalType = data.removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.REMOVAL
            ? {
                ...stage,
                removalResults: (stage.removalResults || []).map((result) =>
                  result.type === removalType.toUpperCase()
                    ? {
                        ...result,
                        removedFiles: data.removed_count || 0,
                        failedFiles: data.failed_count || 0,
                        totalFiles: data.curr_type_files || 0,
                        removedFilesList: data.removed_files || [],
                        failedFilesList: data.failed_files || [],
                      }
                    : result
                ),
              }
            : stage
        ),
      }));
    };

    const handleRemovalTypeCompleted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const removalType = data.removal_type;
      
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.REMOVAL
            ? {
                ...stage,
                removalResults: (stage.removalResults || []).map((result) =>
                  result.type === removalType
                    ? {
                        ...result,
                        status: "completed",
                        removedFiles: data.removed_count || 0,
                        failedFiles: data.failed_count || 0,
                        removedFilesList: data.removed_files || [],
                        failedFilesList: data.failed_files || [],
                      }
                    : result
                ),
              }
            : stage
        ),
      }));
      setCurrentRemovalIndex((prev) => prev + 1);
    };

    const handleRemovalError = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const removalType = data.removal_type;
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.REMOVAL
            ? {
                ...stage,
                removalResults: (stage.removalResults || []).map((result) =>
                  result.type === removalType
                    ? {
                        ...result,
                        status: "error",
                        error: data.error || "Unknown error occurred",
                      }
                    : result
                ),
                status: StageStatus.ERROR,
                message: data.error || "Error during removal",
              }
            : stage
        ),
      }));
    };

    // Register socket event listeners
    socket.on("removal_started", handleRemovalStarted);
    socket.on("removal_type_started", handleRemovalTypeStarted);
    socket.on("removal_progress", handleRemovalProgress);
    socket.on("removal_type_complete", handleRemovalTypeCompleted);
    socket.on("removal_error", handleRemovalError);

    // Cleanup function
    return () => {
      socket.off("removal_started", handleRemovalStarted);
      socket.off("removal_type_started", handleRemovalTypeStarted);
      socket.off("removal_progress", handleRemovalProgress);
      socket.off("removal_type_complete", handleRemovalTypeCompleted);
      socket.off("removal_error", handleRemovalError);
    };
  }, []);

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

  const getStatusIcon = (status: RemovalTypeResult["status"]) => {
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

  const getStatusBadge = (status: RemovalTypeResult["status"]) => {
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

  if (!removalProgress) return null;

  const currentResult = removalResults[currentRemovalIndex];

  return (
    <CardContent className="border-b border-slate-100 pb-6">
      <ProgressHeader
        stageNumber={3}
        stageTitle="Remove File Types"
        status={removalProgress.status}
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
              {removalProgress.status === StageStatus.ERROR ? (
                <span className="text-red-600">
                  {removalProgress.message || "Error during removal"}
                </span>
              ) : (
                `${
                  (removalProgress.removalResults &&
                    removalProgress.removalResults.filter(
                      (r) => r.status === "completed"
                    ).length) ||
                  0
                }/${
                  (removalProgress.removalResults &&
                    removalProgress.removalResults.length) ||
                  0
                } removal types completed`
              )}
            </div>
          </div>
        </div>

        {/* Current Removal Progress */}
        {currentResult && currentResult.status === "running" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-3">
              Currently Removing: {currentResult.type}
            </h4>

            <div className="space-y-3">
              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Files Found:</div>
                <div className="font-medium text-blue-900">
                  {currentResult.totalFiles} files
                </div>
              </div>

              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Removed:</div>
                <div className="font-medium text-blue-900">
                  {currentResult.removedFiles} files
                </div>
              </div>

              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Failed:</div>
                <div className="font-medium text-blue-900">
                  {currentResult.failedFiles} files
                </div>
              </div>

              <StageProgress
                current={currentResult.removedFiles}
                total={currentResult.totalFiles}
                status={removalProgress.status}
              />
            </div>
          </div>
        )}

        {/* Removal Types Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Removal Results</h4>
          <div className="h-[300px] overflow-auto space-y-3">
            {removalResults.map((result, index) => (
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
                      {index === currentRemovalIndex &&
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
                            {result.removedFiles}/{result.totalFiles} files
                          </span>
                        </div>
                      )}
                      {result.status !== "pending" &&
                        result.status !== "running" && (
                          <span>
                            {result.removedFiles} removed, {result.failedFiles}{" "}
                            failed
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

                    {result.status !== "pending" && (
                      <>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">
                              Total Files:
                            </span>
                            <div className="font-medium">
                              {result.totalFiles}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Removed:
                            </span>
                            <div className="font-medium text-green-600">
                              {result.removedFiles}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Failed:
                            </span>
                            <div className="font-medium text-red-600">
                              {result.failedFiles}
                            </div>
                          </div>
                        </div>

                        {result.removedFilesList.length > 0 && (
                          <div>
                            <h5 className="text-sm font-medium text-green-700 mb-2">
                              Removed Files ({result.removedFilesList.length})
                            </h5>
                            <div className="max-h-32 overflow-y-auto bg-green-50 p-2 rounded text-xs">
                              {result.removedFilesList.map((file, idx) => (
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
                                <div
                                  key={idx}
                                  className="truncate text-red-800"
                                >
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
      </div>
    </CardContent>
  );
};

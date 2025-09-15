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

interface VerifyRemovalTypeResult {
  type: string;
  status: "pending" | "running" | "completed" | "error";
  totalFiles: number;
  removedFiles: number;
  failedFiles: number;
  removedFilesList: string[];
  failedFilesList: string[];
  error?: string;
}

export const VerifyRemovalStage = () => {
  const { stageProgress, taskUniqueId } = useAutomateStore();
  const [currentVerifyRemovalIndex, setCurrentVerifyRemovalIndex] = useState(0);

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const verifyRemovalProgress = stageProgress.find(
    (stage) => stage.type === FlowStepType.VERIFY_REMOVAL
  );

  // Separate useEffect for socket listeners
  useEffect(() => {
    if (!taskUniqueId) return;

    const handleVerifyRemovalStarted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      // const verifyRemovalType = data.verify_removal_type.toLowerCase();
      // useAutomateStore.setState((state) => ({
      //   stageProgress: state.stageProgress.map((stage) =>
      //     stage.type === FlowStepType.VERIFY_REMOVAL
      //       ? {
      //           ...stage,
      //           verifyRemovalResults: (stage.verifyRemovalResults || []).map(
      //             (result) =>
      //               result.type === verifyRemovalType
      //                 ? { ...result, status: "running" }
      //                 : result
      //           ),
      //         }
      //       : stage
      //   ),
      // }));
      // if (verifyRemovalType) {
      //   setExpandedTypes((prev) => new Set([...prev, verifyRemovalType]));
      // }
    };

    const handleVerifyRemovalTypeStarted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const verifyRemovalType = data.verify_removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.VERIFY_REMOVAL
            ? {
                ...stage,
                verifyRemovalResults: (stage.verifyRemovalResults || []).map(
                  (result) =>
                    result.type === verifyRemovalType
                      ? {
                          ...result,
                          totalFiles: data.curr_type_files || 0,
                          removedFiles: 0,
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

    const handleVerifyRemovalProgress = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const verifyRemovalType = data.verify_removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.VERIFY_REMOVAL
            ? {
                ...stage,
                verifyRemovalResults: (stage.verifyRemovalResults || []).map(
                  (result) =>
                    result.type === verifyRemovalType
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

    const handleVerifyRemovalTypeCompleted = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const verifyRemovalType = data.verify_removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.VERIFY_REMOVAL
            ? {
                ...stage,
                verifyRemovalResults: (stage.verifyRemovalResults || []).map(
                  (result) =>
                    result.type === verifyRemovalType
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
      setCurrentVerifyRemovalIndex((prev) => prev + 1);
    };

    const handleVerifyRemovalError = (data: any) => {
      if (data.task_id && data.task_id !== taskUniqueId) return;
      const verifyRemovalType = data.verify_removal_type.toLowerCase();
      useAutomateStore.setState((state) => ({
        stageProgress: state.stageProgress.map((stage) =>
          stage.type === FlowStepType.VERIFY_REMOVAL
            ? {
                ...stage,
                verifyRemovalResults: (stage.verifyRemovalResults || []).map(
                  (result) =>
                    result.type === verifyRemovalType
                      ? {
                          ...result,
                          status: "error",
                          error: data.error || "Unknown error occurred",
                        }
                      : result
                ),
                status: StageStatus.ERROR,
                message: data.error || "Error during verify removal",
              }
            : stage
        ),
      }));
    };

    socket.on("verify_removal_started", handleVerifyRemovalStarted);
    socket.on("verify_removal_type_started", handleVerifyRemovalTypeStarted);
    socket.on("verify_removal_progress", handleVerifyRemovalProgress);
    socket.on("verify_removal_type_complete", handleVerifyRemovalTypeCompleted);
    socket.on("verify_removal_error", handleVerifyRemovalError);

    return () => {
      socket.off("verify_removal_started", handleVerifyRemovalStarted);
      socket.off("verify_removal_type_started", handleVerifyRemovalTypeStarted);
      socket.off("verify_removal_progress", handleVerifyRemovalProgress);
      socket.off(
        "verify_removal_type_complete",
        handleVerifyRemovalTypeCompleted
      );
      socket.off("verify_removal_error", handleVerifyRemovalError);
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

  const getStatusIcon = (status: VerifyRemovalTypeResult["status"]) => {
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

  const getStatusBadge = (status: VerifyRemovalTypeResult["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "running":
        return (
          <Badge variant="default" className="bg-blue-100 text-blue-800">
            Running
          </Badge>
        );
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  if (!verifyRemovalProgress) return null;

  const verifyRemovalResults = verifyRemovalProgress.verifyRemovalResults || [];

  return (
    <CardContent className="border-b border-slate-100 pb-6">
      <ProgressHeader
        stageNumber={5}
        stageTitle="Remove Originals"
        status={verifyRemovalProgress.status}
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
              {verifyRemovalProgress.status === StageStatus.ERROR ? (
                <span className="text-red-600">
                  {verifyRemovalProgress.message ||
                    "Error during verify removal"}
                </span>
              ) : (
                `${
                  (verifyRemovalResults &&
                    verifyRemovalResults.filter((r) => r.status === "completed")
                      .length) ||
                  0
                }/${
                  (verifyRemovalResults && verifyRemovalResults.length) || 0
                } removal types completed`
              )}
            </div>
          </div>
        </div>

        {/* Current Verify Removal Progress */}
        {verifyRemovalResults.find((result) => result.status === "running") && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-3">
              Currently Removing:{" "}
              {
                verifyRemovalResults.find(
                  (result) => result.status === "running"
                )?.type
              }
            </h4>

            <div className="space-y-3">
              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Files Found:</div>
                <div className="font-medium text-blue-900">
                  {
                    verifyRemovalResults.find(
                      (result) => result.status === "running"
                    )?.totalFiles
                  }{" "}
                  files
                </div>
              </div>

              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Removed:</div>
                <div className="font-medium text-blue-900">
                  {
                    verifyRemovalResults.find(
                      (result) => result.status === "running"
                    )?.removedFiles
                  }{" "}
                  files
                </div>
              </div>

              <div className="flex items-center text-sm gap-2">
                <div className="text-blue-700 min-w-20">Failed:</div>
                <div className="font-medium text-blue-900">
                  {
                    verifyRemovalResults.find(
                      (result) => result.status === "running"
                    )?.failedFiles
                  }{" "}
                  files
                </div>
              </div>

              <StageProgress
                current={
                  verifyRemovalResults.find(
                    (result) => result.status === "running"
                  )?.removedFiles ?? 0
                }
                total={
                  verifyRemovalResults.find(
                    (result) => result.status === "running"
                  )?.totalFiles ?? 0
                }
                status={verifyRemovalProgress.status}
              />
            </div>
          </div>
        )}

        {/* Verify Removal Types Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-900">Removal Results</h4>
          <div className="max-h-[300px] overflow-auto space-y-3">
            {verifyRemovalResults.map((result, index) => (
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
                      {index === currentVerifyRemovalIndex &&
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

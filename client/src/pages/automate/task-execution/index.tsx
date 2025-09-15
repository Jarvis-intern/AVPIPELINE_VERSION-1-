import { useEffect, useState, useCallback } from "react";

import { AvScanStage } from "./_stages/av-scan";
import { RemovalStage } from "./_stages/removal";
import { ExtractionStage } from "./_stages/extraction";
import { ConversionStage } from "./_stages/conversion";
import { VerificationStage } from "./_stages/verification";
import { VerifyRemovalStage } from "./_stages/verify-removal";

import socket from "@/lib/socket";
import { API_URL } from "@/constants/api";
import { useAutomateStore } from "@/store/automate";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FlowStepType, StageProgress, StageStatus } from "@/types/automate";
import { TaskInfoCard } from "@/pages/automate/task-execution/_components/task-info-card";

// Utility to fetch progress from backend
async function fetchTaskProgress(taskId: string) {
  try {
    const res = await fetch(`${API_URL}/api/task-progress/${taskId}`);
    if (!res.ok) throw new Error("Failed to fetch progress");
    const data = await res.json();
    // The progress is stored as a JSON string in data.Progress
    if (data && data.Progress) {
      return JSON.parse(data.Progress);
    }
    return null;
  } catch (error) {
    // console.error(error);
    return null;
  }
}

export function TaskExecutionStep() {
  const {
    workFlowData,
    setStageProgress,
    stageProgress,
    taskUniqueId,
    setWasResynced,
    filePath,
    avFilePath,
    isWorkflowDataLoaded,
  } = useAutomateStore();
  const [completedSteps, setCompletedSteps] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [socketUserId, setSocketUserId] = useState<string | undefined>(() => {
    // Try to get existing session ID from localStorage
    return localStorage.getItem("socket_session_id") || undefined;
  });

  // Resync function (only updates stageProgress, never triggers workflow)
  const resyncProgress = useCallback(async () => {
    if (!taskUniqueId) return;
    try {
      const progress = await fetchTaskProgress(taskUniqueId);
      if (progress && Array.isArray(progress) && progress.length > 0) {
        setStageProgress(progress);
        setWasResynced(true);
      }
    } catch (err) {
      // console.error("Failed to resync progress:", err);
      // return null;
    }
  }, [taskUniqueId, setStageProgress, setWasResynced]);

  // On mount: fetch backend progress, decide whether to resume or start fresh
  useEffect(() => {
    let cancelled = false;
    async function initializeOrResume() {
      if (!taskUniqueId) return;
      // 1. Try to fetch progress from backend
      const progress = await fetchTaskProgress(taskUniqueId);
      if (cancelled) return;
      if (progress && Array.isArray(progress) && progress.length > 0) {
        setStageProgress(progress);
        setWasResynced(true);
        return;
      }
      // 3. If not found, initialize as fresh
      let initialStageProgress: StageProgress[] = [];
      for (const workFlow of workFlowData) {
        switch (workFlow.type) {
          case FlowStepType.EXTRACTION:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              currentFile: "Starting extraction...",
              currFileNumber: 0,
              filesCount: 0,
            });
            break;
          case FlowStepType.CONVERSION:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              currConversionType: workFlow.conversion
                ? workFlow.conversion[0]
                : "",
              currentFile: "",
              currFileNumber: 0,
              filesCount: 0,
              conversionResults:
                (workFlow.conversion &&
                  workFlow.conversion.map((c) => ({
                    convertedFiles: 0,
                    convertedFilesList: [],
                    currentPhase: 0,
                    failedFiles: 0,
                    failedFilesList: [],
                    status: "pending",
                    totalFiles: 0,
                    type: c,
                    error: undefined,
                  }))) ||
                [],
            });
            break;
          case FlowStepType.REMOVAL:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              currRemovalType: workFlow.removal ? workFlow.removal[0] : "",
              currTypeFilesCount: 0,
              currTypeNumber: 0,
              totalTypes: (workFlow.removal && workFlow.removal.length) || 0,
              totalRemovalFiles: 0,
              totalRemovedCount: 0,
              removalResults: workFlow.removal
                ? workFlow.removal.map((r) => ({
                    failedFiles: 0,
                    failedFilesList: [],
                    removedFiles: 0,
                    removedFilesList: [],
                    status: "pending",
                    totalFiles: 0,
                    type: r,
                    error: undefined,
                  }))
                : [],
            });
            break;
          case FlowStepType.VERIFICATION:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              auto_proceed: workFlow.auto_proceed || false,
            });
            break;
          case FlowStepType.VERIFY_REMOVAL:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              currVerifyRemovalType: workFlow.verify_removal
                ? workFlow.verify_removal[0]
                : "",
              currTypeFilesCount: 0,
              currTypeNumber: 0,
              totalTypes: 0,
              totalVerifyRemovalFiles: 0,
              totalRemovedCount: 0,
              verifyRemovalResults: workFlow.verify_removal
                ? workFlow.verify_removal.map((r) => ({
                    failedFiles: 0,
                    failedFilesList: [],
                    removedFiles: 0,
                    removedFilesList: [],
                    status: "pending",
                    totalFiles: 0,
                    type: r,
                    error: undefined,
                  }))
                : [],
            });
            break;
          case FlowStepType.AV_SCAN:
            initialStageProgress.push({
              type: workFlow.type,
              status: StageStatus.PENDING,
              progress: 0,
              isOrganized: workFlow.isOrganized || false,
              avScanData:
                (workFlow.avs &&
                  workFlow.avs.map((av) => ({
                    avName: av,
                    scanLogs: [],
                    status: "PENDING",
                  }))) ||
                [],
            });
            break;
        }
      }
      setStageProgress(initialStageProgress);
      setWasResynced(false);
      // 4. Start the workflow orchestration in the backend
      socket.connect(socketUserId);
      socket.on("assigned_user_id", (data: { user_id: string }) => {
        setSocketUserId(data.user_id);
        localStorage.setItem("socket_session_id", data.user_id);
      });

      // Emit only the initial start_automation event
      setTimeout(() => {
        socket.emit("start_automation", {
          task_id: taskUniqueId,
          stageProgress: initialStageProgress,
          filePath,
          avFilePath,
        });
      }, 200);
    }
    if (isWorkflowDataLoaded) {
      initializeOrResume();
    }

    return () => {
      cancelled = true;
    };
  }, [isWorkflowDataLoaded]);

  // Listen for resume/focus and websocket reconnect (only resyncs progress)
  useEffect(() => {
    if (!taskUniqueId) return;
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resyncProgress();
      }
    };
    // const handleFocus = () => resyncProgress();
    socket.on("connect", resyncProgress);
    // window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    // Initial resync on mount
    resyncProgress();
    return () => {
      // window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      socket.off("connect", resyncProgress);
    };
  }, [taskUniqueId]);

  // Listen for workflow_progress events from backend and update stageProgress
  useEffect(() => {
    const handleWorkflowProgress = (data: any) => {
      if (data && Array.isArray(data.progress)) {
        setStageProgress(data.progress);
      }
    };
    socket.on("workflow_progress", handleWorkflowProgress);
    return () => {
      socket.off("workflow_progress", handleWorkflowProgress);
    };
  }, []);

  useEffect(() => {
    if (!stageProgress.length) return;
    const completed = stageProgress.filter(
      (stage: StageProgress) => stage.status === StageStatus.DONE
    ).length;
    const hasAnyError = stageProgress.some(
      (stage: StageProgress) => stage.status === StageStatus.ERROR
    );
    setCompletedSteps(completed);
    setHasError(hasAnyError);
  }, [stageProgress]);

  // Filter stages to only show those that are in progress or completed
  const visibleStages = stageProgress;

  return (
    <div className=" flex flex-col space-y-4">
      <TaskInfoCard
        completedSteps={completedSteps}
        hasError={hasError}
        isComplete={completedSteps === stageProgress.length}
        totalSteps={6}
      />
      <Card>
        <CardHeader>
          <CardTitle>Workflow Progress</CardTitle>
        </CardHeader>
        {stageProgress.some(
          (stage: StageProgress) => stage.type === FlowStepType.EXTRACTION
        ) && <ExtractionStage />}
        {visibleStages.some(
          (stage: StageProgress) => stage.type === FlowStepType.CONVERSION
        ) && <ConversionStage />}
        {visibleStages.some(
          (stage: StageProgress) => stage.type === FlowStepType.REMOVAL
        ) && <RemovalStage />}
        {visibleStages.some(
          (stage: StageProgress) => stage.type === FlowStepType.VERIFICATION
        ) && <VerificationStage />}
        {visibleStages.some(
          (stage: StageProgress) => stage.type === FlowStepType.VERIFY_REMOVAL
        ) && <VerifyRemovalStage />}
        {visibleStages.some(
          (stage: StageProgress) => stage.type === FlowStepType.AV_SCAN
        ) && <AvScanStage />}
      </Card>
    </div>
  );
}

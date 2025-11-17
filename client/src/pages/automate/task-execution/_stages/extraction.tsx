import { FileText, Lock, Unlock } from "lucide-react";
import { useState, useEffect } from "react";

import { StageProgress } from "../_components/stage-progress";
import { ProgressHeader } from "../_components/progress-header";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import socket from "@/lib/socket";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { useAutomateStore } from "@/store/automate";
import { FlowStepType, StageStatus } from "@/types/automate";

interface ArchiveFile {
  name: string;
  size: number;
}

export const ExtractionStage = () => {
  const {
    stageProgress,
    filePath,
    taskUniqueId,
    setStageProgress,
    wasResynced,
  } = useAutomateStore();
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentArchive, setCurrentArchive] = useState("");
  const [password, setPassword] = useState("");
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFile[]>([]);
  const [filePasswords, setFilePasswords] = useState<{ [key: string]: string }>(
    {}
  );
  const [showFileGrid, setShowFileGrid] = useState(false);
  const [extractionStats, setExtractionStats] = useState({
    total_files: 0,
    processed_files: 0,
    total_size: 0,
    processed_size: 0,
  });

  const extractionProgress = stageProgress.find(
    (stage) => stage.type === FlowStepType.EXTRACTION
  );

  useEffect(() => {
    setExtractionStats({
      total_files: extractionProgress?.filesCount || 0,
      processed_files: extractionProgress?.currFileNumber || 0,
      total_size: 0,
      processed_size: 0,
    });
  }, [wasResynced]);

  useEffect(() => {
    if (!extractionProgress || !taskUniqueId) return;
    // GUARD: Only trigger extraction if status is RUNNING and not resynced
    if (extractionProgress.status !== StageStatus.RUNNING || wasResynced) {
      return;
    }
    // Start file discovery if we haven't discovered files yet and the stage is RUNNING
    if (archiveFiles.length === 0 && !showFileGrid) {
      setTimeout(() => {
        socket.emit("start_extraction", {
          folder_path: filePath,
          task_id: taskUniqueId,
        });
      }, 100);
      // Start the file discovery process using new Go WebSocket API
    }

    // Listen for archive files discovered
    const handleFilesDiscovered = (data: any) => {
      if (data.task_id !== taskUniqueId) return;

      const files: ArchiveFile[] = data.files.map((file: any) => ({
        name: file.name,
        size: file.size || 0,
      }));

      setArchiveFiles(files);
      setShowFileGrid(true);

      // Update stage progress to show files discovered - keep in RUNNING state
      setStageProgress(
        stageProgress.map((stage) =>
          stage.type === FlowStepType.EXTRACTION
            ? {
                ...stage,
                status: StageStatus.RUNNING,
                currentFile: `Found ${files.length} archive files - Ready to extract`,
                filesCount: files.length,
              }
            : stage
        )
      );
    };

    // Listen for archive extraction started
    const handleArchiveStarted = (data: any) => {
      if (data.task_id !== taskUniqueId) return;
      setStageProgress(
        stageProgress.map((stage) =>
          stage.type === FlowStepType.EXTRACTION
            ? {
                ...stage,
                progress:
                  Math.round(
                    ((data.current_index - 1) / data.total_files) * 100
                  ) || 0,
                status: StageStatus.RUNNING,
                currentFile: data.archive || "",
                currFileNumber: data.current_index || 0,
                filesCount: data.total_files || 0,
              }
            : stage
        )
      );

      setExtractionStats({
        total_files: data.total_files || 0,
        processed_files: data.processed_files || 0,
        total_size: data.total_size || 0,
        processed_size: data.processed_size || 0,
      });
    };

    // Listen for archive extraction complete
    const handleArchiveComplete = (data: any) => {
      if (data.task_id !== taskUniqueId) return;

      if (data.success) {
        setStageProgress(
          stageProgress.map((stage) =>
            stage.type === FlowStepType.EXTRACTION
              ? {
                  ...stage,
                  currentFile: data.archive || "",
                  currFileNumber: data.current_index || 0,
                  filesCount: data.total_files || 0,
                  progress:
                    Math.round((data.current_index / data.total_files) * 100) ||
                    0,
                }
              : stage
          )
        );

        setExtractionStats({
          total_files: data.total_files || 0,
          processed_files: data.processed_files || 0,
          total_size: data.total_size || 0,
          processed_size: data.processed_size || 0,
        });
      } else {
        // Handle failed extraction
        setStageProgress(
          stageProgress.map((stage) =>
            stage.type === FlowStepType.EXTRACTION
              ? {
                  ...stage,
                  status: StageStatus.ERROR,
                  message:
                    data.message ||
                    `Failed to extract ${data.archive}: Password required but not provided`,
                  currentFile: data.archive || "",
                  currFileNumber: data.current_index || 0,
                  filesCount: data.total_files || 0,
                }
              : stage
          )
        );
      }
    };

    // Listen for password requests
    const handlePasswordRequired = (data: any) => {
      if (data.task_id !== taskUniqueId) return;
      setCurrentArchive(data.archive);
      setPasswordDialog(true);
    };

    // Listen for a waiting state when backend needs passwords for some archives
    const handleWaitingForPasswords = (data: any) => {
      if (data.task_id !== taskUniqueId) return;
  setStageProgress(
        stageProgress.map((stage) =>
          stage.type === FlowStepType.EXTRACTION
            ? {
                ...stage,
                status: StageStatus.PENDING,
                message:
                  data.message ||
                  `Waiting for passwords for ${data.required_archives?.length || 1} archive(s)`,
        currentFile: "",
              }
            : stage
        )
      );
      // Keep the file grid visible so the user can provide passwords
      setShowFileGrid(true);
    };

    // Listen for extraction errors
    const handleExtractionError = (data: any) => {
      if (!data.task_id || data.task_id !== taskUniqueId) return;

      setStageProgress(
        stageProgress.map((stage) =>
          stage.type === FlowStepType.EXTRACTION
            ? {
                ...stage,
                status: StageStatus.ERROR,
                message: data.error || "Extraction failed",
              }
            : stage
        )
      );
    };

    // Listen for resuming extraction
    const handleResuming = (data: any) => {
      if (data.task_id !== taskUniqueId) return;
      setShowFileGrid(false);
      setStageProgress(
        stageProgress.map((stage) =>
          stage.type === FlowStepType.EXTRACTION
            ? {
                ...stage,
                status: StageStatus.RUNNING,
                message: "Starting extraction...",
              }
            : stage
        )
      );
    };

    // Register new Go WebSocket event listeners
    socket.on("extraction_files_discovered", handleFilesDiscovered);
    socket.on("extraction_archive_started", handleArchiveStarted);
    socket.on("extraction_archive_complete", handleArchiveComplete);
    socket.on("extraction_password_required", handlePasswordRequired);
  socket.on("extraction_error", handleExtractionError);
  socket.on("extraction_waiting_for_passwords", handleWaitingForPasswords);
    socket.on("extraction_resuming", handleResuming);

    return () => {
      socket.off("extraction_files_discovered", handleFilesDiscovered);
      socket.off("extraction_archive_started", handleArchiveStarted);
      socket.off("extraction_archive_complete", handleArchiveComplete);
      socket.off("extraction_password_required", handlePasswordRequired);
  socket.off("extraction_error", handleExtractionError);
  socket.off("extraction_waiting_for_passwords", handleWaitingForPasswords);
      socket.off("extraction_resuming", handleResuming);
    };
  }, [extractionProgress?.progress, taskUniqueId]);

  const handlePasswordSubmit = () => {
    // Resume extraction with password using new Go WebSocket API
        // Use start_extraction_with_passwords to send password for the specific archive
        socket.emit("start_extraction_with_passwords", {
      folder_path: filePath,
      task_id: taskUniqueId,
          passwords: { [(currentArchive.split("/").pop() || currentArchive)]: password },
      current_archive: currentArchive,
    });
    setPasswordDialog(false);
    setPassword("");
  };

  const handleSkipPassword = () => {
    // Skip this archive and continue with extraction
    setPasswordDialog(false);
    setPassword("");
    // The backend will handle this as a failure and continue with the next file
  };

  // Only emit start_extraction_with_passwords after user submits passwords
  const handleStartExtraction = () => {
    setStageProgress(
      stageProgress.map((stage) =>
        stage.type === FlowStepType.EXTRACTION
          ? { ...stage, status: StageStatus.RUNNING, message: "Starting extraction..." }
          : stage
      )
    );
    socket.emit("start_extraction_with_passwords", {
      folder_path: filePath,
      task_id: taskUniqueId,
      passwords: filePasswords,
    });
    setShowFileGrid(false); // Hide the grid after starting extraction
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  if (!extractionProgress) return null;

  return (
    <>
      <CardContent className="border-b border-slate-100 pb-6">
        <ProgressHeader
          stageNumber={1}
          stageTitle="Extraction"
          status={extractionProgress.status}
        />
        <div className="mt-4 space-y-4">
          <div className="flex items-start gap-2">
            <div className="text-slate-500 text-sm min-w-24">File Path:</div>
            <div className="text-slate-800 flex items-center flex-1">
              <FileText className="h-3.5 w-3.5 mr-1 text-slate-400 flex-shrink-0" />
              <div className="truncate font-mono text-xs bg-slate-50 p-1.5 rounded border border-slate-200 w-full">
                {extractionProgress.status === StageStatus.ERROR ? (
                  <span className="text-red-600">
                    {extractionProgress.message || "Error during extraction"}
                  </span>
                ) : (
                  filePath || "No file path specified"
                )}
              </div>
            </div>
          </div>

          {showFileGrid ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-700">
                  Archive Files Found ({archiveFiles.length})
                </h3>
                <Button onClick={handleStartExtraction} size="sm">
                  Start Extraction
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {archiveFiles.map((file) => {
                  const hasPassword =
                    filePasswords[file.name] &&
                    filePasswords[file.name].trim() !== "";

                  return (
                    <div
                      key={file.name}
                      className="border rounded-lg p-4 space-y-3 border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-medium truncate">
                            {file.name}
                          </span>
                        </div>
                        {hasPassword ? (
                          <Lock className="h-4 w-4 text-green-500" />
                        ) : (
                          <Unlock className="h-4 w-4 text-gray-400" />
                        )}
                      </div>

                      <div className="text-xs text-slate-500">
                        Size: {formatFileSize(file.size)}
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">
                          Password (optional):
                        </label>
                <Input
                          type="password"
                          placeholder="Enter password if needed"
                          value={filePasswords[file.name] || ""}
                          onChange={(e) =>
                            setFilePasswords((prev) => ({
                  ...prev,
                  // Always store by base name only to match backend lookup
                  [file.name.split("/").pop() || file.name]: e.target.value,
                            }))
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <div className="text-slate-500 text-sm min-w-24">
                  Current File:
                </div>
                <div className="text-slate-800 font-medium flex-1 truncate">
                  {extractionProgress.currentFile ||
                    extractionProgress.message ||
                    "Not started"}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="text-slate-500 text-sm min-w-24">Progress:</div>
                <div className="text-slate-800 font-medium flex-1">
                  {extractionStats.processed_files} of{" "}
                  {extractionStats.total_files} files
                </div>
              </div>

              <StageProgress
                current={extractionStats.processed_files || 0}
                total={extractionProgress.filesCount || 0}
                percent={extractionProgress.progress}
                status={extractionProgress.status}
              />
            </>
          )}
        </div>
      </CardContent>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwords required</DialogTitle>
            <DialogDescription>
              Enter passwords to continue extracting protected archives.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="mb-4">
              The archive <span className="font-medium">{currentArchive}</span>{" "}
              requires a password to extract.
            </p>
            <p className="mb-4 text-sm text-slate-600">
              You can provide a password to extract this file, or skip it to
              continue with other files.
            </p>
            <Input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handlePasswordSubmit();
                }
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit}>
              Start Extraction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
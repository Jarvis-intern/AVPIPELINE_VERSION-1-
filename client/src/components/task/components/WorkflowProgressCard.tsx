import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Clock,
  CheckCircle,
  FileText,
  SkipForward,
  StopCircle,
} from "lucide-react";
import { FlowStep, FlowStepType } from "@/types/automate";
import {
  getStepTitle,
  getFormatDisplayName,
  getEngineDisplayName,
  getFileTypeDisplayName,
} from "../utils";
import { ConversionTypes } from "@/types/conversion";
import { useAutomateStore } from "@/store/automate";

interface FileStats {
  totalFiles: number;
  processedFiles: number;
  fileSize: string;
  status: "pending" | "in-progress" | "completed" | "error" | "warning";
  timeTaken?: string;
  error?: string;
}

interface FormatStats {
  format: string;
  totalFiles: number;
  convertedFiles: number;
  status: "pending" | "in-progress" | "completed" | "error" | "warning";
  timeTaken?: string;
}

interface ScanStats {
  engine: string;
  totalFiles: number;
  scannedFiles: number;
  threatsFound: number;
  status: "pending" | "in-progress" | "completed" | "error" | "warning";
  timeTaken?: string;
}

type StepStatus = "pending" | "in-progress" | "completed" | "error" | "warning";

interface WorkflowProgressCardProps {
  workflowSteps: {
    step: FlowStep;
    status: StepStatus;
    progress: number;
    stats: {
      extract?: FileStats;
      convert?: FormatStats[];
      scan?: ScanStats[];
      removeFileTypes?: FileStats;
      verify?: { status: StepStatus };
      removeOriginals?: FileStats;
    };
  }[];
  onSkipStep?: (stepId: number) => void;
  onAbortWorkflow?: (stepId: number) => void;
}

export function WorkflowProgressCard({
  workflowSteps,
  onSkipStep,
  onAbortWorkflow,
}: WorkflowProgressCardProps) {
  const { filePath } = useAutomateStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Progress</CardTitle>
        <div className="text-sm text-slate-500 mb-4">
          Status of each step in the workflow
        </div>
      </CardHeader>
      <hr />
      <CardContent className="p-4">
        <div className="space-y-4">
          {workflowSteps.map((workflowStep, index) => {
            const { step, status, progress } = workflowStep;
            const stepNumber = index + 1;

            return (
              <div
                key={step.id}
                className="border-b border-slate-100 pb-8 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full ${
                      status === "completed"
                        ? "bg-green-100 text-green-800"
                        : status === "in-progress"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-800"
                    } text-xs font-medium`}
                  >
                    {stepNumber}
                  </div>
                  <h3 className="text-base font-medium text-slate-800">
                    {getStepTitle(step.type)}
                  </h3>

                  {status === "completed" && (
                    <Badge
                      variant="outline"
                      className="ml-auto flex items-center gap-1 bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Completed
                    </Badge>
                  )}
                  {status === "in-progress" && (
                    <Badge
                      variant="outline"
                      className="ml-auto flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
                      In progress
                    </Badge>
                  )}
                  {status === "pending" && (
                    <Badge
                      variant="outline"
                      className="ml-auto flex items-center gap-1 bg-slate-50 text-slate-700 border-slate-200"
                    >
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      Pending
                    </Badge>
                  )}

                  {status === "completed" &&
                    step.type === FlowStepType.EXTRACTION &&
                    workflowStep.stats.extract?.timeTaken && (
                      <div className="text-xs text-slate-500 flex items-center ml-2">
                        <Clock className="h-3 w-3 mr-1" />
                        {workflowStep.stats.extract.timeTaken}
                      </div>
                    )}

                  {status === "completed" &&
                    step.type === FlowStepType.CONVERSION && (
                      <div className="text-xs text-slate-500 flex items-center ml-2">
                        <Clock className="h-3 w-3 mr-1" />
                        00:00:00
                      </div>
                    )}

                  {status === "completed" &&
                    step.type === FlowStepType.AV_SCAN && (
                      <div className="text-xs text-slate-500 flex items-center ml-2">
                        <Clock className="h-3 w-3 mr-1" />
                        00:00:00
                      </div>
                    )}
                </div>

                {/* Step specific subtitle */}
                {step.type === FlowStepType.CONVERSION && step.formats && (
                  <div className="text-xs text-slate-500 mb-2">
                    Converting to {step.formats.length} formats
                  </div>
                )}

                {step.type === FlowStepType.AV_SCAN && step.engines && (
                  <div className="text-xs text-slate-500 mb-2">
                    Using {step.engines.length} scan engines
                  </div>
                )}

                {step.type === FlowStepType.REMOVAL && step.fileTypes && (
                  <div className="text-xs text-slate-500 mb-2">
                    Removing {step.fileTypes.length} file types
                  </div>
                )}

                {/* Progress bar */}
                <Progress value={progress} className="h-2 mb-4" />

                {/* Extract Step Details */}
                {step.type === FlowStepType.EXTRACTION &&
                  workflowStep.stats.extract && (
                    <div className="grid grid-cols-4 gap-4 text-sm mt-4">
                      <div>
                        <div className="text-slate-500 mb-1">File Path</div>
                        <div className="text-slate-800 flex items-center">
                          <FileText className="h-3.5 w-3.5 mr-1 text-slate-400" />
                          <div className="truncate max-w-xs font-mono text-xs bg-slate-50 p-1 rounded">
                            {workflowStep.stats.extract.error ? (
                              <span className="text-red-600">
                                {workflowStep.stats.extract.error}
                              </span>
                            ) : (
                              filePath
                            )}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Total Files</div>
                        <div className="text-slate-800 font-medium">
                          {workflowStep.stats.extract.totalFiles}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Total Size</div>
                        <div className="text-slate-800 font-medium">
                          {workflowStep.stats.extract.fileSize}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 mb-1">Status</div>
                        <div className="text-green-600 flex items-center">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          completed
                        </div>
                      </div>
                    </div>
                  )}

                {/* Convert Step Details */}
                {step.type === FlowStepType.CONVERSION &&
                  workflowStep.stats.convert && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                      {/* Make sure to include ALL formats from step.config.formats */}
                      {step.formats?.map((format: string) => {
                        // Find the stats for this format
                        const formatStat = workflowStep.stats.convert?.find(
                          (stat) => stat.format === format
                        );

                        // If no stats exist yet, create a default one
                        const stats = formatStat || {
                          format: format,
                          totalFiles: 0,
                          convertedFiles: 0,
                          status: "pending" as StepStatus,
                        };

                        return (
                          <div
                            key={format}
                            className={`border rounded-md p-3 ${
                              stats.status === "completed"
                                ? "bg-green-50 border-green-100"
                                : stats.status === "in-progress"
                                ? "bg-blue-50 border-blue-100"
                                : stats.status === "error"
                                ? "bg-red-50 border-red-100"
                                : "bg-slate-50 border-slate-100"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="font-medium">
                                {getFormatDisplayName(
                                  format as ConversionTypes
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={`
                                ${
                                  stats.status === "completed"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : stats.status === "in-progress"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : stats.status === "error"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }
                              `}
                              >
                                {stats.status === "completed" && (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                )}
                                {stats.status === "in-progress" && (
                                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse mr-1"></span>
                                )}
                                {stats.status === "pending" && (
                                  <span className="h-2 w-2 rounded-full bg-slate-400 mr-1"></span>
                                )}
                                {stats.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <div className="text-slate-500 text-xs mb-0.5">
                                  Total Files
                                </div>
                                <div className="font-medium">
                                  {stats.totalFiles}
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-500 text-xs mb-0.5">
                                  Converted
                                </div>
                                <div className="font-medium">
                                  {stats.convertedFiles}
                                </div>
                              </div>
                            </div>

                            {stats.timeTaken && (
                              <div className="mt-2 text-xs text-slate-500 flex items-center">
                                <Clock className="h-3 w-3 mr-1" />
                                {stats.timeTaken}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                {/* Scan Step Details */}
                {step.type === FlowStepType.AV_SCAN && step.engines && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                    {/* Make sure to include ALL engines from step.config.engines */}
                    {step.avs?.map((engine: string) => {
                      // Find the stats for this engine
                      const engineStat = workflowStep.stats.scan?.find(
                        (stat) => stat.engine === engine
                      );

                      // If no stats exist yet, create a default one
                      const stats = engineStat || {
                        engine: engine,
                        totalFiles: 0,
                        scannedFiles: 0,
                        threatsFound: 0,
                        status: "pending" as StepStatus,
                      };

                      return (
                        <div
                          key={engine}
                          className={`border rounded-md p-3 ${
                            stats.status === "completed"
                              ? "bg-green-50 border-green-100"
                              : stats.status === "in-progress"
                              ? "bg-blue-50 border-blue-100"
                              : stats.status === "error"
                              ? "bg-red-50 border-red-100"
                              : "bg-slate-50 border-slate-100"
                          }`}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <div className="font-medium">
                              {getEngineDisplayName(engine as string)}
                            </div>
                            <Badge
                              variant="outline"
                              className={`
                                ${
                                  stats.status === "completed"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : stats.status === "in-progress"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : stats.status === "error"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-slate-50 text-slate-700 border-slate-200"
                                }
                              `}
                            >
                              {stats.status === "completed" && (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              {stats.status === "in-progress" && (
                                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse mr-1"></span>
                              )}
                              {stats.status === "pending" && (
                                <span className="h-2 w-2 rounded-full bg-slate-400 mr-1"></span>
                              )}
                              {stats.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <div className="text-slate-500 text-xs mb-0.5">
                                Total Files
                              </div>
                              <div className="font-medium">
                                {stats.totalFiles}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-500 text-xs mb-0.5">
                                Scanned
                              </div>
                              <div className="font-medium">
                                {stats.scannedFiles}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-slate-500 text-xs mb-0.5">
                                Threats Found
                              </div>
                              <div
                                className={`font-medium ${
                                  stats.threatsFound > 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {stats.threatsFound}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Remove File Types Step Details */}
                {step.type === FlowStepType.REMOVAL && step.fileTypes && (
                  <div className="mt-4">
                    {/* Action buttons for in-progress steps */}
                    {status === "in-progress" && (
                      <div className="flex gap-2 mb-4">
                        {onSkipStep && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex items-center gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                            onClick={() => onSkipStep(step.id)}
                          >
                            <SkipForward className="h-3.5 w-3.5" />
                            Skip Step
                          </Button>
                        )}
                        {onAbortWorkflow && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs flex items-center gap-1 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => onAbortWorkflow(step.id)}
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                            Abort Here
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="border rounded-md p-4 bg-slate-50">
                      <h4 className="font-medium mb-3">Selected File Types</h4>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {step.removeFileTypes.map((fileType: string) => (
                          <Badge
                            key={fileType}
                            variant="outline"
                            className="bg-orange-50 border-orange-200 text-orange-700 px-2 py-1"
                          >
                            {getFileTypeDisplayName(fileType)}
                          </Badge>
                        ))}
                      </div>

                      {workflowStep.stats.removeFileTypes && (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <div className="text-slate-500 mb-1">
                              Total Files
                            </div>
                            <div className="font-medium">
                              {workflowStep.stats.removeFileTypes.totalFiles}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Processed</div>
                            <div className="font-medium">
                              {
                                workflowStep.stats.removeFileTypes
                                  .processedFiles
                              }
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-500 mb-1">Status</div>
                            <div className="flex items-center">
                              {status === "in-progress" ? (
                                <span className="text-blue-600 flex items-center">
                                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse mr-1.5"></span>
                                  In progress
                                </span>
                              ) : status === "completed" ? (
                                <span className="text-green-600 flex items-center">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Completed
                                </span>
                              ) : (
                                <span className="text-slate-600 flex items-center">
                                  <span className="h-2 w-2 rounded-full bg-slate-400 mr-1.5"></span>
                                  Pending
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

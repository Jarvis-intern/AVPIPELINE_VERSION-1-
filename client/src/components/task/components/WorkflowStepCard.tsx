import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepStatus } from "../types";
import { FlowStep, FlowStepType } from "@/types/automate";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAutomateStore } from "@/store/automate";

interface WorkflowStepCardProps {
  step: FlowStep;
  status: StepStatus;
  progress: number;
  stats: any;
}

export function WorkflowStepCard({
  step,
  status,
  progress,
  stats,
}: WorkflowStepCardProps) {
  const { filePath } = useAutomateStore();

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "error":
        return "text-red-500";
      case "in-progress":
        return "text-blue-500";
      default:
        return "text-slate-500";
    }
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "in-progress":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const renderStepContent = () => {
    switch (step.type) {
      case FlowStepType.EXTRACTION:
        return (
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">File Path:</span>
              <span className="text-sm font-medium">{filePath || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">File Size:</span>
              <span className="text-sm font-medium">
                {stats.extract?.fileSize || "0 B"}
              </span>
            </div>
          </section>
        );

      case FlowStepType.CONVERSION:
        return (
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Current File:
              </span>
              <span className="text-sm font-medium">
                {stats.convert?.currentFile || "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Progress:</span>
              <span className="text-sm font-medium">
                {stats.convert?.convertedFiles || 0} /{" "}
                {stats.convert?.totalFiles || 0} files
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </section>
        );

      case FlowStepType.REMOVAL:
        return (
          <section className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                Current File:
              </span>
              <span className="text-sm font-medium">
                {stats.removeFileTypes?.currentFile || "N/A"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Progress:</span>
              <span className="text-sm font-medium">
                {stats.removeFileTypes?.processedFiles || 0} /{" "}
                {stats.removeFileTypes?.totalFiles || 0} files
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <CardContent>
      <section className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-base">
            {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
          </h4>
          {getStatusIcon(status)}
        </div>
        <span className={`text-sm font-semibold ${getStatusColor(status)}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </section>
      {renderStepContent()}
    </CardContent>
  );
}

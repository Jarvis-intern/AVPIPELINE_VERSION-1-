import { Card } from "@/components/ui/card";
import { CheckCircle, AlertCircle, ChevronRight } from "lucide-react";
import { StepStatus } from "../types";
import { FlowStep } from "@/types/automate";

interface WorkflowPipelineCardProps {
  flowSteps: FlowStep[];
  executingSteps: {
    step: FlowStep;
    status: StepStatus;
    progress: number;
    stats: any;
  }[];
  onSkipStep?: (stepId: number) => void;
  onAbortWorkflow?: (stepId: number) => void;
}

export function WorkflowPipelineCard({
  flowSteps,
  executingSteps,
}: WorkflowPipelineCardProps) {
  return (
    <Card className="border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-medium mb-4 text-slate-800">
        Workflow Pipeline
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {flowSteps.map((step, index) => {
          const isActive =
            executingSteps.find((s) => s.step.id === step.id)?.status ===
            "in-progress";
          const isCompleted =
            executingSteps.find((s) => s.step.id === step.id)?.status ===
            "completed";
          const isError =
            executingSteps.find((s) => s.step.id === step.id)?.status ===
            "error";

          // Use more subtle styling for workflow steps
          let textColor = "text-slate-600";
          let indicator = ""; // Empty by default

          if (isActive) {
            textColor = "text-blue-700 font-medium";
            indicator = "border-b-2 border-blue-500";
          } else if (isCompleted) {
            textColor = "text-slate-800";
            indicator = "border-b border-green-500";
          } else if (isError) {
            textColor = "text-red-600";
            indicator = "border-b border-red-500";
          }

          return (
            <div key={step.id} className="flex items-center">
              <div className={`py-1 px-2 ${textColor} ${indicator}`}>
                {isActive && (
                  <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
                )}
                {isCompleted && (
                  <CheckCircle className="inline-block h-3.5 w-3.5 text-green-500 mr-1" />
                )}
                {isError && (
                  <AlertCircle className="inline-block h-3.5 w-3.5 text-red-500 mr-1" />
                )}
                {!isActive && !isCompleted && !isError && (
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-300 mr-1.5"></span>
                )}
                {step.type.charAt(0).toUpperCase() + step.type.slice(1)}
              </div>
              {index < flowSteps.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-1 text-slate-400" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

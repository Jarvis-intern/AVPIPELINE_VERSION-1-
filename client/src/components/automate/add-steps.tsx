import { useEffect } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { getStepIcon } from "./icons";
import { Button } from "../ui/button";

import { useApi } from "@/hooks/useApi";
import { StageService } from "@/services/stage";
import { useAutomateStore } from "@/store/automate";
import { FlowStepType, Stage } from "@/types/automate";

interface AddStepsProps {
  isLockMode: boolean;
  onAddStep: (id: number, type: FlowStepType) => void;
}

export const AddSteps = ({ isLockMode, onAddStep }: AddStepsProps) => {
  const { workFlowData, stages, setStages } = useAutomateStore();

  const { execute: getStages } = useApi<Stage[]>();

  useEffect(() => {
    getStages(
      () => StageService.getAllStages(),
      (data) => setStages(data)
    );
  }, []);

  return (
    <div className="flex justify-center">
      <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-4 w-[500px]">
        <div className="text-center">
          <Plus className="h-8 w-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Add next step
          </p>
          {isLockMode ? (
            <p className="text-amber-500 text-sm flex items-center justify-center">
              <AlertCircle className="h-4 w-4 mr-1" />
              Switch to Edit Mode to add steps
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {stages.map(
                (stage: Stage) =>
                  !workFlowData.some((step) => step.type === stage.name) && (
                    <Button
                      key={stage.id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        onAddStep(stage.id, stage.name as FlowStepType)
                      }
                    >
                      {getStepIcon(stage.name as FlowStepType)}
                      <span className="ml-1">{stage.name}</span>
                    </Button>
                  )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

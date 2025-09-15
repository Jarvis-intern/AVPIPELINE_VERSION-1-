import {
  ChevronRight,
  X,
  Lock,
  Edit,
  AlertCircle,
  ArrowRight,
  ArrowDown,
} from "lucide-react";
import React, { useState } from "react";

import { AddSteps } from "./add-steps";
import { getStepIcon, getStepTitle } from "./icons";
import { WorkflowStepCard } from "./WorkflowStepCard";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  validateWorkflowSelection,
  validateCardSelections,
} from "@/lib/automate/validators";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAutomateStore } from "@/store/automate";
import { useMasterDataStore } from "@/store/master-data";
import { FlowStep, FlowStepType, Stage } from "@/types/automate";

interface WorkflowBuilderProps {
  showDeleteDialog: boolean;
  isCreatingWorkflow: boolean;
  showHelpTip: boolean;
  onToggleHelpTip: () => void;
  onAddStep: (id: number, type: FlowStepType) => void;
  onConfirmDeleteStep: () => void;
  onToggleDeleteDialog: (show: boolean) => void;
  onPrevStep: () => void;
}

export function WorkflowBuilder({
  showDeleteDialog,
  isCreatingWorkflow,
  showHelpTip,
  onToggleHelpTip,
  onAddStep,
  onConfirmDeleteStep,
  onToggleDeleteDialog,
  onPrevStep,
}: WorkflowBuilderProps) {
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showLockModePopover, setShowLockModePopover] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [validationError, setValidationError] = useState<{
    show: boolean;
    message: string;
  }>({ show: false, message: "" });
  const [showValidationErrorModal, setShowValidationErrorModal] =
    useState(false);

  const { workFlowData, stages, isLockMode, setIsLockMode } =
    useAutomateStore();
  const { masterData } = useMasterDataStore();

  const handleContinue = () => {
    // Validate workflow selection
    if (!validateWorkflowSelection(workFlowData)) {
      setValidationError({
        show: true,
        message: "Please add at least one step to your workflow.",
      });
      setShowValidationErrorModal(true);
      return;
    }

    // Validate that at least one option is selected in each card
    const validationResult = validateCardSelections(workFlowData);
    if (!validationResult.isValid && validationResult.stepType) {
      let stepName = "";
      switch (validationResult.stepType) {
        case FlowStepType.CONVERSION:
          stepName = "Convert Files";
          break;
        case FlowStepType.AV_SCAN:
          stepName = "Scan Files";
          break;
        case FlowStepType.VERIFY_REMOVAL:
          stepName = "Remove File Types";
          break;
        default:
          stepName = getStepTitle(validationResult.stepType as FlowStepType);
      }

      setValidationError({
        show: true,
        message: `Please select at least one option in the <span class="text-blue-700 font-medium">"${stepName}"</span> card.`,
      });
      setShowValidationErrorModal(true);
      return;
    }
  };

  const handleLockModeClick = (e: React.MouseEvent) => {
    if (isLockMode) {
      setPopoverPosition({ x: e.clientX, y: e.clientY });
      setShowLockModePopover(true);
      setTimeout(() => setShowLockModePopover(false), 3000);
    }
  };

  // Function to get a readable workflow summary
  const getWorkflowSummary = () => {
    return workFlowData
      .filter((step) => step.enabled)
      .map((step) => {
        let stepDescription = getStepTitle(step.type);

        // Add details for specific step types
        if (
          step.type === FlowStepType.CONVERSION &&
          step.conversion &&
          step.conversion.length > 0
        ) {
          const formatNames = step.conversion.map(
            (conv) => masterData.conversion.find((f) => f === conv) || conv
          );
          stepDescription += ` (${formatNames.join(", ")})`;
        } else if (
          step.type === FlowStepType.AV_SCAN &&
          step.avs &&
          step.avs.length > 0
        ) {
          const engineNames = step.avs.map(
            (av) => masterData.avs.find((e) => e === av) || av
          );
          stepDescription += ` (${engineNames.join(", ")})`;
        } else if (
          step.type === FlowStepType.REMOVAL &&
          step.removal &&
          step.removal.length > 0
        ) {
          const fileTypeNames = step.removal.map(
            (fileType) =>
              masterData.removal.find((f) => f === fileType) || fileType
          );
          stepDescription += ` (${fileTypeNames.join(", ")})`;
        }

        return stepDescription;
      });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <h2 className="text-lg font-medium">Build Your Workflow</h2>
          <Badge
            variant="outline"
            className="ml-2 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800"
          >
            Required
          </Badge>
        </div>

        <div className="flex space-x-2">
          <Button
            variant={isLockMode ? "default" : "outline"}
            size="sm"
            className={`flex items-center space-x-1 ${
              isLockMode ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
            }`}
            onClick={() => setIsLockMode(!isLockMode)}
          >
            {isLockMode ? (
              <>
                <Lock className="h-4 w-4 mr-1" />
                Lock Mode
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-1" />
                Edit Mode
              </>
            )}
          </Button>
        </div>
      </div>

      {showHelpTip && (
        <div className="relative bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-sm pr-10 border border-amber-200 dark:border-amber-800/50">
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 top-1 h-6 w-6 text-amber-600 dark:text-amber-400 hover:text-amber-800"
            onClick={onToggleHelpTip}
          >
            <X className="h-3 w-3" />
          </Button>
          <p>
            Create your workflow by adding and configuring steps. Each step will
            be executed in the order shown.
            {isLockMode ? (
              <span className="block mt-1 font-medium">
                Currently in Lock Mode: Switch to Edit Mode to make changes.
              </span>
            ) : (
              <span className="block mt-1">
                You can reorder steps using the up/down arrows.
              </span>
            )}
          </p>
        </div>
      )}

      <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <div className="relative flex flex-col space-y-8 min-w-[600px]">
          {workFlowData.length === 0 ? (
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="text-center">
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  No workflow steps added yet
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {stages.map((stage: Stage) => (
                    <Button
                      key={stage.id}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() =>
                        !isLockMode &&
                        onAddStep(stage.id, stage.name as FlowStepType)
                      }
                      disabled={isLockMode}
                    >
                      {getStepIcon(stage.name as FlowStepType)}
                      <span className="ml-1">{stage.name}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Flow steps with connecting lines */}
              {workFlowData.map((step: FlowStep, index: number) => (
                <div
                  key={step.id}
                  style={{
                    transition:
                      "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                  className="relative rounded-lg"
                  onClick={
                    isLockMode ? (e) => handleLockModeClick(e) : undefined
                  }
                >
                  {/* Vertical connector line */}
                  {index > 0 && (
                    <div className="absolute left-1/2 -top-8 transform -translate-x-1/2 h-8 w-0.5 bg-green-800 "></div>
                  )}

                  <div className="flex justify-center">
                    <div className="w-[600px] relative">
                      <WorkflowStepCard step={step} index={index} />
                    </div>
                  </div>

                  {/* Flow direction indicator */}
                  {index < workFlowData.length - 1 && (
                    <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 z-10">
                      <div className="h-8 w-8  rounded-full outline outline-blue-500 bg-white dark:bg-white-600 shadow-md text-blue-500 flex items-center justify-center">
                        <ArrowDown className="h-5 w-5" />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add step button at the end */}
              {workFlowData.length < 6 && (
                <AddSteps isLockMode={isLockMode} onAddStep={onAddStep} />
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button variant="outline" onClick={onPrevStep}>
          Back to Task
        </Button>
        <Button
          onClick={handleContinue}
          isLoading={isCreatingWorkflow}
          type="submit"
          disabled={
            !validateWorkflowSelection(workFlowData) ||
            !validateCardSelections(workFlowData)
          }
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Continue to Files
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={onToggleDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Removal</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this workflow step? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onToggleDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={onConfirmDeleteStep}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workflow confirmation modal */}
      <Dialog
        open={showConfirmationModal}
        onOpenChange={setShowConfirmationModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Workflow</DialogTitle>
            <DialogDescription>
              Review your workflow before proceeding to file selection.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-medium mb-2">Workflow Steps:</h3>

              <div className="space-y-2">
                {getWorkflowSummary().map((stepDescription, index) => (
                  <div key={index} className="flex items-center">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-2">
                      {index + 1}
                    </div>
                    <div className="flex-grow">{stepDescription}</div>
                    {index < getWorkflowSummary().length - 1 && (
                      <ArrowRight className="h-4 w-4 mx-2 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="outline"
              onClick={() => setShowConfirmationModal(false)}
            >
              Edit Workflow
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Confirm & Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Mode Popover */}
      {showLockModePopover && (
        <div
          className="fixed z-50 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 shadow-lg"
          style={{
            left: `${popoverPosition.x}px`,
            top: `${popoverPosition.y - 80}px`,
            transform: "translate(-50%, 0)",
            maxWidth: "300px",
          }}
        >
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium">Workflow is Locked</h4>
              <p className="text-sm">
                The workflow is currently in Lock Mode. Switch to Edit Mode to
                make changes.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 border-amber-300 hover:bg-amber-100 text-amber-800"
                onClick={() => {
                  setIsLockMode(false);
                  setShowLockModePopover(false);
                }}
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Switch to Edit Mode
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Error Modal */}
      <Dialog
        open={showValidationErrorModal}
        onOpenChange={setShowValidationErrorModal}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertCircle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-red-700">
                Attention Required
              </DialogTitle>
            </div>
            <DialogDescription
              className="pt-3"
              dangerouslySetInnerHTML={{ __html: validationError.message }}
            />
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button onClick={() => setShowValidationErrorModal(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { Lock, Check } from "lucide-react";

import { getStepIcon, getStepTitle, getStepDescription } from "./icons";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAutomateStore } from "@/store/automate";
import { useMasterDataStore } from "@/store/master-data";
import { FlowStep, FlowStepType } from "@/types/automate";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";

interface WorkflowStepCardProps {
  step: FlowStep;
  index: number;
}

export function WorkflowStepCard({ step, index }: WorkflowStepCardProps) {
  const { workFlowData, isLockMode, setConfigData, setAutoProceed } =
    useAutomateStore();
  const { masterData } = useMasterDataStore();

  // Helper function to check if an item is selected
  const isItemSelected = (configKey: keyof FlowStep, itemId: string) => {
    return step[configKey]?.includes(itemId) ?? false;
  };

  // Helper function to get the appropriate button text
  const getToggleAllButtonText = (
    configKey: keyof FlowStep,
    allItems: any[]
  ) => {
    return step[configKey]?.length === allItems.length
      ? "Clear All"
      : "Select All";
  };

  const toggleSelectableItem = (
    id: number,
    key: keyof FlowStep,
    value: string
  ) => {
    const step = workFlowData.find((step) => step.id === id);
    if (step) {
      if (step[key].includes(value)) {
        setConfigData(
          id,
          key,
          step[key].filter((item: string) => item !== value)
        );
      } else {
        setConfigData(id, key, [...step[key], value]);
      }
    }
  };

  // Helper function to render a selectable item
  const renderSelectableItem = (
    id: string,
    name: string,
    configKey: string,
    onToggle: (id: any) => void
  ) => {
    const isSelected = isItemSelected(configKey, id);
    return (
      <div
        key={id}
        className={`px-2 py-1.5 rounded-md text-xs flex items-center space-x-1.5 cursor-pointer ${
          isSelected
            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        }`}
        onClick={isLockMode ? undefined : () => onToggle(id)}
      >
        <div
          className={`w-3 h-3 rounded-sm border ${
            isSelected
              ? "bg-blue-500 border-blue-500 dark:bg-blue-600 dark:border-blue-600"
              : "bg-white border-slate-300 dark:bg-slate-700 dark:border-slate-600"
          }`}
        >
          {isSelected && <Check className="w-3 h-3 text-white" />}
        </div>
        <span>{name}</span>
      </div>
    );
  };

  return (
    <div className="relative">
      {/* Main card */}
      <Card className="border-2 border-blue-300 dark:border-blue-800 shadow-sm w-full relative">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400">
              {getStepIcon(step.type)}
            </div>
            <CardTitle className="text-base font-medium">
              {getStepTitle(step.type)}
            </CardTitle>
          </div>

          <div className="flex items-center space-x-1">
            {isLockMode && (
              <Button
                size="icon"
                variant="destructive"
                className="h-6 w-6 rounded-full"
              >
                <Lock className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 pt-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            {getStepDescription(step.type)}
          </p>

          {/* Extract step configuration */}
          {step.type === FlowStepType.EXTRACTION && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3 mt-0.5">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                      Automatic Archive Extraction
                    </h4>
                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                      <p>
                        • Automatically detects and extracts all supported
                        archive formats (ZIP, RAR, 7Z, TAR, etc.)
                      </p>
                      <p>
                        • Prompts for passwords when needed - optional for files
                        that may or may not be password-protected
                      </p>
                      <p>
                        • Handles nested archives and preserves folder structure
                      </p>
                      <p>
                        • Supports multiple archive formats in a single
                        operation
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Convert step configuration */}
          {step.type === FlowStepType.CONVERSION && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">
                  Formats to Convert
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setConfigData(step.id, "conversion", masterData.conversion)
                  }
                  disabled={isLockMode}
                >
                  {getToggleAllButtonText("conversion", masterData.conversion)}
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {masterData.conversion.map((conversion) =>
                  renderSelectableItem(
                    conversion,
                    conversion,
                    "conversion",
                    (conv) => toggleSelectableItem(step.id, "conversion", conv)
                  )
                )}
              </div>
            </div>
          )}

          {/* Scan step configuration */}
          {step.type === FlowStepType.AV_SCAN && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">Scan Engines</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigData(step.id, "avs", masterData.avs)}
                  disabled={isLockMode}
                >
                  {getToggleAllButtonText("avs", masterData.avs)}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {masterData.avs.map((av) =>
                  renderSelectableItem(av, av, "avs", (av) =>
                    toggleSelectableItem(step.id, "avs", av)
                  )
                )}
              </div>
            </div>
          )}

          {/* Remove file types step configuration */}
          {step.type === FlowStepType.REMOVAL && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">
                  File Types to Remove
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setConfigData(step.id, "removal", masterData.removal)
                  }
                  disabled={isLockMode}
                >
                  {getToggleAllButtonText("removal", masterData.removal)}
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto">
                {masterData.removal.map((removal) =>
                  renderSelectableItem(
                    removal,
                    removal,
                    "removal",
                    (fileType) =>
                      toggleSelectableItem(step.id, "removal", fileType)
                  )
                )}
              </div>
            </div>
          )}

          {/* Verify step configuration */}
          {step.type === FlowStepType.VERIFICATION && (
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-2">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Manual Verification Stage
                    </h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      This stage allows users to manually verify the results of
                      previous operations before proceeding.
                    </p>
                  </div>
                </div>
              </div>
              {/* Auto-proceed toggle */}
              <div className="flex items-center mt-3">
                <Switch
                  id={`auto-proceed-verification-${index}`}
                  checked={step.auto_proceed}
                  onCheckedChange={(checked) => {
                    setAutoProceed(step.id, checked);
                  }}
                />
                <Label
                  htmlFor={`auto-proceed-verification-${index}`}
                  className="ml-2 text-xs"
                >
                  Auto-proceed after verification
                </Label>
              </div>
            </div>
          )}

          {/* Remove originals step configuration */}
          {step.type === FlowStepType.VERIFY_REMOVAL && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label
                  htmlFor={`secure-delete-${index}`}
                  className="text-xs font-medium"
                >
                  Secure Delete
                </Label>
                <Switch
                  id={`secure-delete-${index}`}
                  checked={step.secureDelete !== false}
                  onCheckedChange={(checked) => {
                    if (!isLockMode) {
                      // Update the step config directly
                      step.secureDelete = checked;
                    }
                  }}
                  disabled={isLockMode}
                />
              </div>
              <div className="flex justify-between items-center">
                <Label
                  htmlFor={`keep-log-${index}`}
                  className="text-xs font-medium"
                >
                  Keep Deletion Log
                </Label>
                <Switch
                  id={`keep-log-${index}`}
                  checked={step.keepDeletionLog !== false}
                  onCheckedChange={(checked) => {
                    if (!isLockMode) {
                      // Update the step config directly
                      step.keepDeletionLog = checked;
                    }
                  }}
                  disabled={isLockMode}
                />
              </div>
              <div className="flex justify-between items-center">
                <Label className="text-xs font-medium">
                  File Types to Remove after Verification
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setConfigData(
                      step.id,
                      "verify_removal",
                      masterData.verify_removal
                    )
                  }
                  disabled={isLockMode}
                >
                  {getToggleAllButtonText(
                    "verify_removal",
                    masterData.verify_removal
                  )}
                </Button>
              </div>
              <div className="grid grid-cols-5 gap-1 max-h-40 overflow-y-auto">
                {masterData.verify_removal.map((removal) =>
                  renderSelectableItem(
                    removal,
                    removal,
                    "verify_removal",
                    (fileType) =>
                      toggleSelectableItem(step.id, "verify_removal", fileType)
                  )
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

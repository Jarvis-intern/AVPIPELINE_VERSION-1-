import { AlertTriangle } from "lucide-react";

interface WorkflowErrorAlertProps {
  isVisible: boolean;
}

export function WorkflowErrorAlert({ isVisible }: WorkflowErrorAlertProps) {
  if (!isVisible) return null;
  
  return (
    <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3 mb-4">
      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
      <div>
        <h3 className="font-medium text-red-800">Workflow Error</h3>
        <p className="text-red-700 text-sm mt-1">
          An error occurred during workflow execution. Some steps may have been skipped or aborted.
        </p>
      </div>
    </div>
  );
}

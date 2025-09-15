import { Download, RefreshCw } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskFormData } from "@/types/automate";

interface TaskHeaderProps {
  taskId: string;
  taskData: TaskFormData;
  isComplete: boolean;
  onReset?: () => void;
}

export function TaskHeader({
  taskId,
  taskData,
  isComplete,
  onReset,
}: TaskHeaderProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-4 rounded-lg shadow-sm mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Task Execution</h1>
          <div className="text-slate-700 text-sm mt-0.5 flex flex-wrap gap-x-6">
            <span>
              Task: <span className="font-medium">{taskData.name}</span>
            </span>
            <span>
              ID:{" "}
              <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">
                {taskId}
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {isComplete && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5"
              onClick={onReset}
            >
              <RefreshCw className="h-4 w-4" />
              Create New Task
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>
    </Card>
  );
}

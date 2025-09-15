import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAutomateStore } from "@/store/automate";

interface TaskInfoCardProps {
  isComplete: boolean;
  completedSteps: number;
  totalSteps: number;
  hasError: boolean;
}

export function TaskInfoCard({
  isComplete,
  completedSteps,
  totalSteps,
  hasError,
}: TaskInfoCardProps) {
  const { taskData, filePath } = useAutomateStore();

  const overallProgress = ((completedSteps / totalSteps) * 100).toFixed(1);

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader>
        <CardTitle>Task Information</CardTitle>
      </CardHeader>
      <hr />
      <CardContent className="space-y-4">
        <section className="gap-y-4 grid grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Task Name</h3>
            <p className="mt-1 text-slate-800 font-medium">{taskData.name}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-600">
              Description
            </h3>
            <p className="mt-1 text-slate-700">
              {taskData.description || "No description provided"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600">Assignee</h3>
            <p className="mt-1 text-slate-800">
              {taskData.assignee || "Unassigned"}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-600">System IP</h3>
            <p className="mt-1 text-slate-800">{taskData.systemIp}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-600">File Path</h3>
            <p className="mt-1 text-xs font-mono bg-slate-100 p-2 rounded border border-slate-200">
              {filePath || "/path/to/file"}
            </p>
          </div>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-slate-600">
            Overall Progress
          </h3>
          <div className="mt-2 h-3 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                isComplete
                  ? "bg-green-500"
                  : hasError
                  ? "bg-red-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-sm flex justify-between font-medium">
            <span className="text-slate-700">
              {completedSteps} of {totalSteps} steps completed
            </span>
            <span
              className={`${
                isComplete
                  ? "text-green-600"
                  : hasError
                  ? "text-red-600"
                  : "text-blue-600"
              }`}
            >
              {overallProgress}%
            </span>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

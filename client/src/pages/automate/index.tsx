import { toast } from "sonner";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { useApi } from "@/hooks/useApi";
import { TaskService } from "@/services";
import { TabList } from "@/components/tab-list";
import { useAutomateStore } from "@/store/automate";
import { Card, CardContent } from "@/components/ui/card";
import { FlowStep, TaskFormData } from "@/types/automate";
import { DEFAULT_FLOW_STEPS } from "@/constants/automate";

export default function AutomateLayout() {
  const navigate = useNavigate();

  const pathName = useLocation().pathname;
  const tab = pathName.split("/").pop() as string;

  const {
    setTaskUniqueId,
    setTaskData,
    setWorkFlowData,
    setFilePath,
    setAvFilePath,
    setIsWorkflowData,
  } = useAutomateStore();

  const { execute: getTask } = useApi<{
    task: TaskFormData;
    filePath: string;
    avFilePath: string;
    workflow: FlowStep[];
  }>();

  useEffect(() => {
    if (
      tab === "task" ||
      tab === "workflow" ||
      tab === "files" ||
      tab === "execution"
    ) {
      return;
    }
    navigate(`/automate/task`);
  }, [navigate]);

  useEffect(() => {
    const taskUniqueId = localStorage.getItem("taskUniqueId");
    if (taskUniqueId) {
      setTaskUniqueId(taskUniqueId);
      getTask(
        () => TaskService.getTask(taskUniqueId),
        (task) => {
          setTaskData(task.task);
          setFilePath(task.filePath);
          setAvFilePath(task.avFilePath);
          setWorkFlowData(
            task.workflow.length > 0 ? task.workflow : DEFAULT_FLOW_STEPS
          );
          setTimeout(() => {
            setIsWorkflowData(true);
          }, 100);
        },
        (error) => {
          toast.error(error.message || "Failed to fetch task");
        }
      );
    }
  }, []);

  return (
    <div className="h-screen flex flex-col">
      <div className="container mx-auto py-8 px-4 max-w-7xl flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 flex flex-col overflow-hidden">
            <TabList tabs={["Task", "Workflow", "Files", "Execution"]} />
            <div className="flex-1 overflow-auto">
              <Outlet />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

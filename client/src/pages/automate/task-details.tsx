import { toast } from "sonner";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useApi } from "@/hooks/useApi";
import { TaskService } from "@/services";
import { Button } from "@/components/ui/button";
import { TaskFormData } from "@/types/automate";
import { useAutomateStore } from "@/store/automate";
import { LabelInput } from "@/components/label-input";
import { getIpAddress } from "@/services/system-info";
import { validateTaskForm } from "@/lib/automate/validators";

const TaskDetailsStep = () => {
  const navigate = useNavigate();

  const { taskUniqueId, setTaskUniqueId, taskData, setTaskData } =
    useAutomateStore();

  const { loading: submitting, execute: submitTaskDetails } = useApi<{
    task_unique_id: string;
  }>();

  // Event handlers
  const handleTaskInputChange = (field: keyof TaskFormData, value: string) => {
    setTaskData({ ...taskData, [field]: value });
  };

  // Navigation functions
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validateTaskForm(taskData)) {
      return;
    }

    await submitTaskDetails(
      () => TaskService.initializeTask(taskData, taskUniqueId),
      (response) => {
        // Success callback
        setTaskUniqueId(response.task_unique_id);
        localStorage.setItem("taskUniqueId", response.task_unique_id);
        navigate("/automate/workflow");
      },
      (error) => {
        // Error callback
        toast.error(error.message || "Failed to create task");
      }
    );
  };

  useEffect(() => {
    if (!taskUniqueId)
      getIpAddress().then((ip) => {
        setTaskData({ ...taskData, systemIp: ip });
      });
  }, [taskUniqueId]);

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <LabelInput
            label="Task Name"
            value={taskData.name}
            onChange={(value) => handleTaskInputChange("name", value)}
            placeholder="Enter descriptive task name"
            required
          />

          <LabelInput
            label="Assignee"
            value={taskData.assignee}
            onChange={(value) => handleTaskInputChange("assignee", value)}
            placeholder="Enter your name"
            required
          />

          <LabelInput
            label="System IP"
            value={taskData.systemIp}
            onChange={(value) => handleTaskInputChange("systemIp", value)}
            helpText="System IP is automatically detected"
            readOnly
          />
        </div>

        <div className="space-y-4">
          <LabelInput
            label="Description"
            value={taskData.description}
            type="textarea"
            onChange={(value) => handleTaskInputChange("description", value)}
            placeholder="Enter task description"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button
          type="submit"
          disabled={!validateTaskForm(taskData)}
          className="px-6"
          isLoading={submitting}
        >
          Continue to Workflow
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};

export default TaskDetailsStep;

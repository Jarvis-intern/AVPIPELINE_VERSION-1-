import { APIError } from "./errors";

import { api } from "@/lib/api";
import { TaskApiResponse } from "@/types/task";
import { FlowStep, TaskFormData } from "@/types/automate";
import { TaskDataToWorkFlowData, workFlowDataToTaskData } from "@/lib/helper";

export const TaskService = {
  async initializeTask(
    taskData: TaskFormData,
    taskUniqueId: string | null
  ): Promise<{ task_unique_id: string }> {
    try {
      return await api.post<{ task_unique_id: string }>(
        "/api/task/task-initialisation",
        {
          task_unique_id: taskUniqueId,
          name: taskData.name,
          description: taskData.description,
          assignee: taskData.assignee,
          system_ip: taskData.systemIp,
        }
      );
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to initialize task: ${error.message}`);
      }
      throw error;
    }
  },

  async createWorkflow(
    workflowData: FlowStep[],
    taskUniqueId: string
  ): Promise<void> {
    const taskData = workFlowDataToTaskData(workflowData);
    try {
      await api.post("/api/task/create-workflow", {
        ...taskData,
        unique_id: taskUniqueId,
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to initialize task: ${error.message}`);
      }
      throw error;
    }
  },

  async addFilePath(
    taskUniqueId: string,
    filePath: string,
    avFilePath: string
  ): Promise<void> {
    try {
      await api.post("/api/task/add-file-path", {
        unique_id: taskUniqueId,
        file_path: filePath,
        av_file_path: avFilePath,
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to add file path: ${error.message}`);
      }
      throw error;
    }
  },

  async getTask(taskUniqueId: string): Promise<{
    task: TaskFormData;
    filePath: string;
    avFilePath: string;
    workflow: FlowStep[];
  }> {
    try {
      const data = await api.get<{ task: TaskApiResponse }>(
        `/api/task/${taskUniqueId}`
      );
      return {
        task: {
          name: data.task.name,
          description: data.task.description,
          assignee: data.task.assignee,
          systemIp: data.task.system_ip,
        },
        filePath: data.task.file_path,
        avFilePath: data.task.av_file_path,
        workflow: TaskDataToWorkFlowData(data.task),
      };
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to get task: ${error.message}`);
      }
      throw error;
    }
  },

  async updateTask(
    taskUniqueId: string,
    taskData: Partial<TaskFormData>
  ): Promise<void> {
    try {
      await api.put(`/api/task/${taskUniqueId}`, taskData);
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to update task: ${error.message}`);
      }
      throw error;
    }
  },

  async deleteTask(taskUniqueId: string): Promise<void> {
    try {
      await api.delete(`/api/task/${taskUniqueId}`);
    } catch (error) {
      if (error instanceof APIError) {
        throw new Error(`Failed to delete task: ${error.message}`);
      }
      throw error;
    }
  },
};

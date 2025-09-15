import { createBrowserRouter } from "react-router-dom";

import { Logs } from "@/pages/Logs";
import ConvertLayout from "@/pages/convert";
import AutomateLayout from "@/pages/automate";
import FilesStep from "@/pages/automate/files";
import { RootLayout } from "@/layouts/RootLayout";
import WorkflowStep from "@/pages/automate/workflow";
import ConvertFolderPage from "@/pages/convert/Folder";
import ConvertSettingsPage from "@/pages/convert/Settings";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import TaskDetailsStep from "@/pages/automate/task-details";
import { Dashboard } from "@/components/dashboard/Dashboard";
import ConvertFilePage from "@/pages/convert/File"; // Import the new component
import Vms from "@/pages/avs";
import Vm from "@/pages/avs/av";
import { ScanPage } from "@/pages/scan";
import { TaskExecutionStep } from "@/pages/automate/task-execution";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "convert/*",
        element: <ConvertLayout />,
        children: [
          {
            path: "file",
            element: <ConvertFilePage />,
          },
          {
            path: "folder",
            element: <ConvertFolderPage />,
          },
          {
            path: "settings",
            element: <ConvertSettingsPage />,
          },
        ],
      },
      {
        path: "scan",
        element: <ScanPage />,
      },
      {
        path: "logs",
        element: <Logs />,
      },
      {
        path: "vms",
        children: [
          {
            path: "",
            element: <Vms />,
          },
          {
            path: ":id",
            element: <Vm />,
          },
        ],
      },
      {
        path: "automate/*",
        element: <AutomateLayout />,
        children: [
          {
            path: "task",
            element: <TaskDetailsStep />,
          },
          {
            path: "workflow",
            element: <WorkflowStep />,
          },
          {
            path: "files",
            element: <FilesStep />,
          },
          {
            path: "execution",
            element: <TaskExecutionStep />,
          },
        ],
      },
    ],
  },
]);

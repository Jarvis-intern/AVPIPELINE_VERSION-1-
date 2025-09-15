import { useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApi } from "@/hooks/useApi";
import { TaskService } from "@/services";
import { Button } from "@/components/ui/button";
import { useAutomateStore } from "@/store/automate";
import { LabelInput } from "@/components/label-input";
import { validateFileSelection } from "@/lib/automate/validators";

const FilesStep = () => {
  const navigate = useNavigate();
  const { execute: addFilePath, loading: isAddingFilePath } = useApi<void>();

  const { taskUniqueId, filePath, setFilePath, avFilePath, setAvFilePath, setIsWorkflowData } =
    useAutomateStore();

  const handlePrevStep = () => {
    navigate("/automate/workflow");
  };

  const handleNextStep = () => {
    if (taskUniqueId) {
      addFilePath(
        () => TaskService.addFilePath(taskUniqueId, filePath, avFilePath),
        () => {
          setIsWorkflowData(true);
          navigate("/automate/execution");
        }
      );
    }
  };

  return (
    <div className="space-y-8 px-2">
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Enter Path</CardTitle>
            <CardDescription>
              Enter the path for both relative to server and Antivirus VMs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <LabelInput
                label="File Path"
                value={filePath}
                onChange={setFilePath}
                helpText="This path is relative to the data server mounted on this application VM"
              />
              <LabelInput
                label="AV File Path"
                value={avFilePath}
                onChange={setAvFilePath}
                helpText="This path is relative to the data server mounted on every Antivirus's VM. Please keep the path of data server on each Antivirus VM same otherwise it will not run properly."
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button onClick={handlePrevStep} variant="outline">
          Back to Workflow
        </Button>
        <Button
          onClick={handleNextStep}
          disabled={!validateFileSelection(filePath) || isAddingFilePath}
          isLoading={isAddingFilePath}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Create Task
        </Button>
      </div>
    </div>
  );
};

export default FilesStep;

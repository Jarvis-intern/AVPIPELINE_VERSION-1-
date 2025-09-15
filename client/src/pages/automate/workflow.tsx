import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useApi } from "@/hooks/useApi";
import { TaskService } from "@/services/task";
import { FlowStepType } from "@/types/automate";
import { MasterData } from "@/types/master-data";
import { useAutomateStore } from "@/store/automate";
import { useMasterDataStore } from "@/store/master-data";
import { MasterDataService } from "@/services/master-data";
import { createNewStep } from "@/lib/automate/workflow";
import { WorkflowBuilder } from "@/components/automate/WorkflowBuilder";

const WorkflowStep = () => {
  const navigate = useNavigate();

  const { execute: createWorkflow, loading: isCreatingWorkflow } =
    useApi<void>();

  const { taskUniqueId, workFlowData, setWorkFlowData } = useAutomateStore();
  const { setMasterData } = useMasterDataStore();

  const { execute: getMasterData } = useApi<MasterData>();

  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [stepToDelete, setStepToDelete] = useState<number | null>(null);
  const [showHelpTip, setShowHelpTip] = useState<boolean>(true);

  // Workflow step functions
  const handleAddFlowStep = (id: number, type: FlowStepType) => {
    setWorkFlowData([...workFlowData, createNewStep(id, type)]);
  };

  const confirmDeleteStep = () => {
    if (stepToDelete !== null) {
      setWorkFlowData(workFlowData.filter((_, i) => i !== stepToDelete));
      setShowDeleteDialog(false);
      setStepToDelete(null);
    }
  };

  const handlePrevStep = () => {
    navigate("/automate/task");
  };

  const handleWorkflowSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (taskUniqueId) {
      await createWorkflow(
        () => TaskService.createWorkflow(workFlowData, taskUniqueId),
        () => {
          navigate("/automate/files");
        }
      );
    }
  };

  useEffect(() => {
    getMasterData(
      () => MasterDataService.getMasterData(),
      (data) => setMasterData(data)
    );
  }, []);

  return (
    <form onSubmit={handleWorkflowSubmit} className="space-y-6">
      <WorkflowBuilder
        onAddStep={handleAddFlowStep}
        showHelpTip={showHelpTip}
        onToggleHelpTip={() => setShowHelpTip(false)}
        showDeleteDialog={showDeleteDialog}
        onConfirmDeleteStep={confirmDeleteStep}
        onToggleDeleteDialog={setShowDeleteDialog}
        onPrevStep={handlePrevStep}
        isCreatingWorkflow={isCreatingWorkflow}
      />
    </form>
  );
};

export default WorkflowStep;

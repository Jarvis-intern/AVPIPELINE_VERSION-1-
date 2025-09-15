import { WorkflowProgressCard } from './components/WorkflowProgressCard';
import { TaskDetailsUIProps } from './types';

export function TaskDetailsUI({
  workflowSteps,
  onSkipStep,
  onAbortWorkflow
}: TaskDetailsUIProps) {
  return (
    <div className="space-y-6 px-4 py-4">
      {/* Workflow Progress */}
      <WorkflowProgressCard 
        workflowSteps={workflowSteps}
        onSkipStep={onSkipStep}
        onAbortWorkflow={onAbortWorkflow}
      />
    </div>
  );
}

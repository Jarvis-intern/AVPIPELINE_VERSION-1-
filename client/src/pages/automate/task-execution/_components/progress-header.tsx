import { CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StageStatus } from "@/types/automate";

interface ProgressHeaderProps {
  stageNumber: number;
  stageTitle: string;
  status: StageStatus;
}

export const ProgressHeader = ({
  stageNumber,
  stageTitle,
  status,
}: ProgressHeaderProps) => {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div
        className={`flex items-center justify-center w-6 h-6 rounded-full ${
          status === StageStatus.DONE
            ? "bg-green-100 text-green-800"
            : status === StageStatus.RUNNING
            ? "bg-blue-100 text-blue-800"
            : "bg-slate-100 text-slate-800"
        } text-xs font-medium`}
      >
        {stageNumber}
      </div>
      <h3 className="text-base font-medium text-slate-800">{stageTitle}</h3>

      {status === StageStatus.DONE && (
        <Badge
          variant="outline"
          className="ml-auto flex items-center gap-1 bg-green-50 text-green-700 border-green-200"
        >
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      )}
      {status === StageStatus.RUNNING && (
        <Badge
          variant="outline"
          className="ml-auto flex items-center gap-1 bg-blue-50 text-blue-700 border-blue-200"
        >
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          In progress
        </Badge>
      )}
      {status === StageStatus.PENDING && (
        <Badge
          variant="outline"
          className="ml-auto flex items-center gap-1 bg-slate-50 text-slate-700 border-slate-200"
        >
          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
          Pending
        </Badge>
      )}
    </div>
  );
};

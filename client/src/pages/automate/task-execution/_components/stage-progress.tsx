import { Progress } from "@/components/ui/progress";
import { StageStatus } from "@/types/automate";

interface StageProgressProps {
  current: number;
  total: number;
  percent?: number;
  status: StageStatus;
}

export const StageProgress = ({
  percent,
  current,
  total,
  status,
}: StageProgressProps) => {
  let progressPercentage = 0;

  if (percent !== undefined && percent !== null) {
    progressPercentage = percent;
  } else {
    progressPercentage = total > 0 ? Math.round((current / total) * 100) : 0;
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm">
        <div className="text-slate-600 font-medium">
          {current} / {total} files
        </div>
        <div className="text-slate-600 font-medium">{progressPercentage}%</div>
      </div>

      <Progress
        value={progressPercentage}
        className={`h-2 ${
          status === StageStatus.DONE
            ? "bg-green-100"
            : status === StageStatus.RUNNING
            ? "bg-blue-100"
            : "bg-slate-100"
        }`}
      />
    </div>
  );
};

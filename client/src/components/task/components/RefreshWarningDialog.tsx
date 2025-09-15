import { AlertOctagon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface RefreshWarningDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RefreshWarningDialog({
  isOpen,
  onClose,
}: RefreshWarningDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertOctagon className="h-8 w-8 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-800">
            Warning: Task in Progress
          </h2>
        </div>
        <p className="text-slate-600 mb-6">
          A task is currently processing. If you refresh or leave this page, you
          will lose the current task progress.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Stay on Page
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onClose();
              window.location.reload();
            }}
          >
            Refresh Anyway
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { CheckCircle, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import { ProgressHeader } from "../_components/progress-header";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAutomateStore } from "@/store/automate";
import {
  FlowStepType,
  StageStatus,
  VerificationProgress,
} from "@/types/automate";
import socket from "@/lib/socket";

export const VerificationStage = () => {
  const { stageProgress, taskUniqueId } = useAutomateStore();

  // Find the verification step
  const verificationProgress = stageProgress.find(
    (stage) => stage.type === FlowStepType.VERIFICATION
  ) as VerificationProgress | undefined;

  const taskId = taskUniqueId || "";

  const handleProceed = () => {
    if (taskId) {
      socket.emit("proceed_verification", { task_id: taskId });
    }
  };

  useEffect(() => {
    if (
      verificationProgress?.auto_proceed &&
      verificationProgress?.status === StageStatus.RUNNING &&
      taskId
    ) {
      socket.emit("proceed_verification", { task_id: taskId });
    }
  }, [
    verificationProgress?.auto_proceed,
    verificationProgress?.status,
    taskId,
  ]);

  if (!verificationProgress) return null;

  return (
    <CardContent className="space-y-6">
      <ProgressHeader
        stageNumber={4}
        stageTitle="Verification"
        status={verificationProgress.status}
      />

      {/* Auto-proceed UI */}
      {verificationProgress.auto_proceed &&
        verificationProgress.status !== StageStatus.DONE && (
          <div className="mt-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-start gap-6">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
                <div className="space-y-6 flex-1">
                  <div>
                    <h3 className="text-xl font-semibold text-blue-900">
                      Automatic Verification
                    </h3>
                    <p className="mt-2 text-sm text-blue-800 leading-relaxed">
                      Verification is being automatically approved based on your
                      workflow settings. No action is required.
                    </p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-lg border border-blue-200 shadow-sm">
                    <h4 className="font-medium text-blue-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      What happens next:
                    </h4>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3 text-sm text-blue-800">
                        <div className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                        The pipeline will automatically proceed to the next step
                        after verification.
                      </li>
                    </ul>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      disabled
                      className="bg-blue-400 text-white px-6 py-2 rounded-lg opacity-60 cursor-not-allowed"
                    >
                      Auto-Proceeding...
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Manual verification UI */}
      {!verificationProgress.auto_proceed &&
        verificationProgress.status !== StageStatus.DONE && (
          <div className="mt-6">
            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200 rounded-xl p-8 shadow-sm">
              <div className="flex items-start gap-6">
                <div className="bg-yellow-100 p-3 rounded-full">
                  <ShieldCheck className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="space-y-6 flex-1">
                  <div>
                    <h3 className="text-xl font-semibold text-yellow-900">
                      Verification Required
                    </h3>
                    <p className="mt-2 text-sm text-yellow-800 leading-relaxed">
                      The file processing pipeline has completed the conversion
                      and removal steps. Please take a moment to review the
                      changes made to your files before proceeding.
                    </p>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm p-6 rounded-lg border border-yellow-200 shadow-sm">
                    <h4 className="font-medium text-yellow-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      What to check:
                    </h4>
                    <ul className="space-y-3">
                      {[
                        "Verify that all files have been converted to the desired format",
                        "Confirm that specified file types have been removed",
                        "Check that no unexpected files were affected",
                        "Ensure the output quality meets your requirements",
                      ].map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-sm text-yellow-800"
                        >
                          <div className="mt-1 h-1.5 w-1.5 rounded-full bg-yellow-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleProceed}
                      disabled={
                        verificationProgress.status === StageStatus.PENDING
                      }
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg transition-all duration-200 hover:shadow-md"
                    >
                      Proceed to Next Step
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      {verificationProgress.status === StageStatus.DONE && (
        <div className="mt-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-900">
                  Verification Complete
                </h3>
                <p className="mt-1 text-sm text-green-800">
                  You have approved the changes. The pipeline will now proceed
                  to the next step.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </CardContent>
  );
};

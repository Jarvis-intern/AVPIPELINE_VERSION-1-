import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ConversionApiResponse } from "@/types/conversion";
import { useWebSocketStore } from "@/store/globalWebSocketStore";
import { useConversionStore, PhaseProgress } from "@/store/conversionStore";

export function RootLayout() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showCompactSidebar, setShowCompactSidebar] = useState(false);
  const location = useLocation();

  // Get current page from pathname
  const currentPage = location.pathname.split("/")[1] || "dashboard";

  // Effect to toggle dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // WebSocket connection
  useEffect(() => {
    useWebSocketStore.getState().connect();
  }, []);

  // Conversion event subscriptions (global)
  const { subscribeToEvent } = useWebSocketStore();
  const {
    setSocketUserId,
    setIsConverting,
    setConversionProgress,
    setCurrentPhase,
    setPhases,
    setConversionError,
    setApiResponse,
  } = useConversionStore();

  // Helper to update phases based on previous state
  const updatePhases = (
    updater: (prev: PhaseProgress[]) => PhaseProgress[]
  ) => {
    const prev = useConversionStore.getState().phases;
    setPhases(updater(prev));
  };

  useEffect(() => {
    // Assigned user id
    const unsubAssignedUserId = subscribeToEvent(
      "assigned_user_id",
      (data: { user_id: string }) => {
        setSocketUserId(data.user_id);
      }
    );

    // Conversion started
    const unsubConversionStarted = subscribeToEvent(
      "conversion_started",
      () => {
        setIsConverting(true);
        setConversionProgress({
          total: 0,
          converted: 0,
          failed: 0,
          currentFile: "",
          size: 0,
          phase: 1,
          converted_files: [],
          failed_files: [],
        });
      }
    );

    // Phase started
    const unsubPhaseStarted = subscribeToEvent("phase_started", (data: any) => {
      setCurrentPhase(data.phase);
      updatePhases((prev: PhaseProgress[]) => [
        ...prev,
        {
          phase: data.phase,
          totalFiles: data.totalFiles ?? data.total_files ?? 0,
          convertedFiles: 0,
          failedFiles: 0,
          size: data.size || 0,
          startTime: new Date().toISOString(),
          converted_files_list: [],
          failed_files_list: [],
        },
      ]);
    });

    // File progress
    const unsubFileProgress = subscribeToEvent("file_progress", (data: any) => {
      const prev = useConversionStore.getState().conversionProgress;
      setConversionProgress(
        prev
          ? {
              ...prev,
              currentFile: data.current_file || prev.currentFile,
              converted: data.converted_count || prev.converted,
              failed: data.failed_count || prev.failed,
              total: data.total_files || prev.total,
              phase: data.phase || prev.phase,
              converted_files: data.converted_files || prev.converted_files,
              failed_files: data.failed_files || prev.failed_files,
            }
          : {
              currentFile: data.current_file || "",
              converted: data.converted_count || 0,
              failed: data.failed_count || 0,
              total: data.total_files || 0,
              phase: data.phase || 1,
              size: data.size || 0,
              converted_files: data.converted_files || [],
              failed_files: data.failed_files || [],
            }
      );
      if (data.error) {
        setConversionError(data.error);
      }
      updatePhases((prev: PhaseProgress[]) =>
        prev.map((phase: PhaseProgress) =>
          phase.phase === (data.phase || 1)
            ? {
                ...phase,
                convertedFiles: data.converted_count || phase.convertedFiles,
                failedFiles: data.failed_count || phase.failedFiles,
                converted_files_list:
                  data.converted_files || phase.converted_files_list,
                failed_files_list: data.failed_files || phase.failed_files_list,
              }
            : phase
        )
      );
    });

    // Phase completed
    const unsubPhaseCompleted = subscribeToEvent(
      "phase_completed",
      (data: any) => {
        updatePhases((prev: PhaseProgress[]) =>
          prev.map((phase: PhaseProgress) =>
            phase.phase === (data.phase || 1)
              ? {
                  ...phase,
                  convertedFiles: data.converted_count || phase.convertedFiles,
                  failedFiles: data.failed_count || phase.failedFiles,
                  endTime: new Date().toISOString(),
                  converted_files_list:
                    data.converted_files || phase.converted_files_list,
                  failed_files_list:
                    data.failed_files || phase.failed_files_list,
                }
              : phase
          )
        );
      }
    );

    // Conversion type complete
    const unsubConversionTypeComplete = subscribeToEvent(
      "conversion_type_complete",
      (data: ConversionApiResponse) => {
        setIsConverting(false);
        setApiResponse(data);
        toast.success("Conversion completed successfully!");
      }
    );

    // Conversion error
    const unsubConversionError = subscribeToEvent(
      "conversion_error",
      (data: { error: string }) => {
        setConversionError(data.error);
        setIsConverting(false);
        toast.error(data.error || "Conversion failed");
      }
    );

    return () => {
      unsubAssignedUserId();
      unsubConversionStarted();
      unsubPhaseStarted();
      unsubFileProgress();
      unsubPhaseCompleted();
      unsubConversionTypeComplete();
      unsubConversionError();
    };
  }, [
    subscribeToEvent,
    setSocketUserId,
    setIsConverting,
    setConversionProgress,
    setCurrentPhase,
    setPhases,
    setConversionError,
    setApiResponse,
  ]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div
      className={cn(
        "min-h-screen flex bg-background text-foreground font-sans",
        isDarkMode && "dark"
      )}
    >
      <Sidebar
        isDarkMode={isDarkMode}
        showCompactSidebar={showCompactSidebar}
        currentPage={currentPage}
        setShowCompactSidebar={setShowCompactSidebar}
      />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          currentPage={currentPage}
        />

        <main className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { Sun, Moon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "../ConnectionStatus";
import { useCallback, useState } from "react";
import { toast } from "sonner";

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  currentPage: string;
}

export function Header({
  isDarkMode,
  toggleDarkMode,
  currentPage,
}: HeaderProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "convert", label: "Convert Files" },
    { id: "scan", label: "AV Scan" },
    { id: "logs", label: "Scan Logs" },
  ];

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 bg-white dark:bg-slate-800 shadow-sm">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-white">
          {navItems.find((item) => item.id === currentPage)?.label}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <ConnectionStatus />
        <ClearCookieButton />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="rounded-full"
        >
          {isDarkMode ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  );
}

// Button to clear task cookie and reset session
function ClearCookieButton() {
  const [loading, setLoading] = useState(false);

  const handleClear = useCallback(async () => {
    try {
      setLoading(true);
      // Backend call kept in case server wants to reset anything
      fetch("/api/session/clear-task-cookie", { method: "POST" }).catch(() => {});
      // Clear relevant localStorage keys
      localStorage.removeItem("taskUniqueId");
      localStorage.removeItem("socket_session_id");
      toast.success("Automation session cleared");
      // Optionally also reset whole localStorage: localStorage.clear();
      // Force soft reload of current route to reset state stores
      setTimeout(() => window.location.assign("/automate/task"), 200);
    } catch (e: any) {
      toast.error(e.message || "Failed to clear session");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClear}
      disabled={loading}
      title="Clear task session cookie"
      className="rounded-full"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

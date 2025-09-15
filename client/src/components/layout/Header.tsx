import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConnectionStatus } from "../ConnectionStatus";

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

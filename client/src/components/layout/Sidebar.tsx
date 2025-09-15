import {
  ShieldAlert,
  LayoutDashboard,
  FileType,
  Shield,
  FileText,
  GitBranch,
  Server,
} from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  isDarkMode: boolean;
  showCompactSidebar: boolean;
  currentPage: string;
  setShowCompactSidebar: (show: boolean) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/" },
  { id: "convert", label: "Convert Files", icon: FileType, path: "/convert" },
  { id: "scan", label: "AV Scan", icon: Shield, path: "/scan" },
  { id: "automate", label: "Automation", icon: GitBranch, path: "/automate" },
  { id: "logs", label: "Scan Logs", icon: FileText, path: "/logs" },
  { id: "vms", label: "VMs", icon: Server, path: "/vms" },
];

export function Sidebar({
  isDarkMode,
  showCompactSidebar,
  currentPage,
}: SidebarProps) {
  return (
    <div
      className={cn(
        "border-r transition-all duration-300 flex flex-col",
        isDarkMode
          ? "bg-slate-900 text-white border-slate-700/50"
          : "bg-[#2563eb] text-white border-blue-700/50",
        showCompactSidebar ? "w-16" : "w-64"
      )}
    >
      {/* Logo & Brand */}
      <div
        className={cn(
          "flex items-center h-16",
          isDarkMode
            ? "border-b border-slate-700/50"
            : "border-b border-blue-500",
          showCompactSidebar ? "justify-center" : "px-4"
        )}
      >
        {showCompactSidebar ? (
          <ShieldAlert className="h-8 w-8 text-white" />
        ) : (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "p-2 rounded-md",
                isDarkMode ? "bg-blue-500/20" : "bg-blue-500/20"
              )}
            >
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg text-white">
              AV Pipeline
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className={cn("py-4", showCompactSidebar ? "px-2" : "px-3")}>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size={showCompactSidebar ? "icon" : "default"}
                className={cn(
                  "w-full justify-start font-normal",
                  currentPage === item.id
                    ? isDarkMode
                      ? "bg-slate-800 hover:bg-slate-700 text-white"
                      : "bg-blue-700 hover:bg-blue-800 text-white"
                    : isDarkMode
                    ? "text-slate-300 hover:text-white hover:bg-slate-800"
                    : "text-white hover:text-white hover:bg-blue-700/80",
                  showCompactSidebar ? "h-12 w-12 " : "px-3 h-10 "
                )}
                asChild
              >
                <Link to={item.path}>
                  <item.icon
                    className={cn(
                      showCompactSidebar ? "h-5 w-5" : "h-5 w-5 mr-3"
                    )}
                  />
                  {!showCompactSidebar && <span>{item.label}</span>}
                </Link>
              </Button>
            ))}
          </nav>
        </div>
      </ScrollArea>
    </div>
  );
}

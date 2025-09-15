import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";

import { AV } from "@/types";
import { formatDateTime } from "@/lib/helper";
import { LogLevel, ScanLog } from "@/proto/av_scanner";
import { Button } from "@/components/ui/button";

export const ScanLogs = ({ logs }: { av: AV; logs: ScanLog[] }) => {
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const scrollToBottom = () => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
            className="h-6 px-2"
          >
            {isVisible ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
            <span className="ml-1 text-xs">Logs ({logs.length})</span>
          </Button>
        </div>
        {isVisible && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>

      {isVisible && (
        <div
          ref={logsContainerRef}
          className={`bg-gray-900 rounded-lg p-4 font-mono text-xs overflow-auto transition-all duration-200 ${
            isExpanded ? "h-[400px]" : "h-[200px]"
          }`}
        >
          {logs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`whitespace-nowrap ${
                log.level === LogLevel.ERROR
                  ? "text-red-500"
                  : log.level === LogLevel.WARNING
                  ? "text-yellow-500"
                  : log.level === LogLevel.DEBUG
                  ? "text-gray-500"
                  : "text-white"
              }`}
            >
              <span className="text-gray-500">
                {formatDateTime(log.timestamp)} |
              </span>
              {log.filePath && (
                <span className="text-blue-400 ml-2">{log.filePath}</span>
              )}
              <span className="ml-2">{log.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

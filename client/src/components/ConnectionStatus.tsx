import { Wifi, WifiOff, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useWebSocketStore } from "@/store/globalWebSocketStore";

export function ConnectionStatus(): React.JSX.Element {
  const { connectionState } = useWebSocketStore();

  const getStatusConfig = () => {
    switch (connectionState) {
      case "connected":
        return {
          icon: <Wifi className="h-3.5 w-3.5" />,
          text: "Connected",
          className:
            "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
        };
      case "connecting":
        return {
          icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
          text: "Connecting",
          className:
            "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800",
        };
      case "disconnected":
      default:
        return {
          icon: <WifiOff className="h-3.5 w-3.5" />,
          text: "Disconnected",
          className:
            "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge
      variant={
        connectionState === "connected"
          ? "success"
          : connectionState === "connecting"
          ? "default"
          : "destructive"
      }
      className="space-x-2"
    >
      {config.icon}
      <span>{config.text}</span>
    </Badge>
  );
}

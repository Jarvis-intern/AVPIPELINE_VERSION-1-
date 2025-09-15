import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { useLocation } from "react-router-dom";

interface TabListProps {
  tabs: string[];
}

export const TabList = ({ tabs }: TabListProps) => {
  const pathName = useLocation().pathname.split("/").pop();

  return (
    <div className="w-full flex items-center mb-4 p-1 bg-muted/50 rounded-md gap-x-2">
      {tabs.map((tab) => (
        <Button
          variant="ghost"
          className={cn(
            "w-full hover:bg-muted",
            pathName === tab.toLowerCase() &&
              "bg-primary hover:bg-primary text-primary-foreground hover:text-primary-foreground"
          )}
          key={tab}
          value={tab}
        >
          {tab}
        </Button>
      ))}
    </div>
  );
};

// file: client/src/pages/convert/index.tsx

import { useState, useEffect } from "react";
import { FolderOpen, Settings, File as FileIcon } from "lucide-react"; // Import FileIcon
import { Outlet, useLocation, useNavigate } from "react-router-dom";

// *** FIX: Update ConversionRoutes enum to include 'FILE' ***
import { ConversionRoutes } from "@/types/conversion"; 
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ConvertLayout() {
  const [activeTab, setActiveTab] = useState<ConversionRoutes>(
    ConversionRoutes.FOLDER
  );

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentTab = location.pathname.split("/").pop() as ConversionRoutes;
    if (Object.values(ConversionRoutes).includes(currentTab)) {
      setActiveTab(currentTab);
    } else {
      // Default to folder page if path is invalid
      navigate("/convert/folder");
      setActiveTab(ConversionRoutes.FOLDER);
    }
  }, [location.pathname, navigate]);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6">File Conversion</h1>

      <Tabs
        value={activeTab}
        onValueChange={(value: string) =>
          setActiveTab(value as ConversionRoutes)
        }
        className="w-full"
      >
        {/* *** FIX: Update TabsList to include 'File Upload' *** */}
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger
            value={ConversionRoutes.FILE} // Use enum value
            onClick={() => navigate("/convert/file")}
            className="flex items-center gap-2"
          >
            <FileIcon className="h-4 w-4" />
            <span>File Upload</span>
          </TabsTrigger>
          <TabsTrigger
            value={ConversionRoutes.FOLDER} // Use enum value
            onClick={() => navigate("/convert/folder")}
            className="flex items-center gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            <span>Folder Upload</span>
          </TabsTrigger>
          <TabsTrigger
            value={ConversionRoutes.SETTINGS} // Use enum value
            onClick={() => navigate("/convert/settings")}
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>
        <Outlet />
      </Tabs>
    </div>
  );
}
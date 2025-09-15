// file: client/src/pages/convert/Folder.tsx

import React, { ChangeEvent, useRef, useState } from "react";
import {
  Loader2,
  ChevronDown,
  AlertCircle,
  FileX,
  FileCheck,
  Clock,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTimeTaken } from "@/lib/helper";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CONVERSION_TYPES } from "@/constants/conversion";
import { useConversionStore } from "@/store/conversionStore";
import { useWebSocketStore } from "@/store/globalWebSocketStore";
import { API_URL } from "@/constants/api";

const ConvertFolderPage: React.FC = () => {
  const {
    selectedFormat,
    setSelectedFormat,
    isConverting,
    currentPhase,
    socketUserId,
    conversionProgress,
    phases,
    conversionError,
    apiResponse,
    reset,
  } = useConversionStore();

  const { isConnected } = useWebSocketStore();

  // *** NEW STATE AND REFS FOR FILE HANDLING ***
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [displayPath, setDisplayPath] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  
  // *** NEW HANDLERS FOR FILE/FOLDER SELECTION ***
  const handleBrowseClick = () => {
    // Reset input value before click to allow re-selecting the same folder/file
    if (folderInputRef.current) folderInputRef.current.value = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
    
    // For now, we'll assume "folder" selection is primary for this page.
    // A toggle could be added later if single file uploads are also needed here.
    folderInputRef.current?.click();
  };

  const handleFolderSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(files);
      // Display the folder name from the relative path
      const firstFile = files[0];
      const relativePath = (firstFile as any).webkitRelativePath; // Standard property for folder uploads
      const folderName = relativePath.split('/')[0];
      setDisplayPath(folderName);
    }
  };

  // *** UPDATED MAIN CONVERSION HANDLER ***
  const handleConvert = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Please select a folder to convert.");
      return;
    }
    if (!isConnected) {
      toast.error("Not connected to the server. Please wait for connection.");
      return;
    }
    if (!socketUserId) {
      toast.error("User session not established. Please refresh the page.");
      return;
    }

    reset(); // Reset previous conversion state

    const formData = new FormData();
    formData.append("conversion_type", selectedFormat);
    formData.append("user_id", socketUserId);

    for (let i = 0; i < selectedFiles.length; i++) {
      // The browser automatically provides the relative path for folder uploads
      formData.append("files", selectedFiles[i], selectedFiles[i].name);
    }

    try {
      const response = await fetch(`${API_URL}/api/convert/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "File upload failed");
      }
      
      toast.success(result.message);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast.error(errorMessage);
    }
  };

  const getProgressPercentage = () => {
    if (!conversionProgress) return 0;
    if (conversionProgress.total === 0) return 0; // Avoid division by zero
    return (conversionProgress.converted / conversionProgress.total) * 100;
  };

  return (
    <TabsContent value="folder" className="space-y-4">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFolderSelect} // Reusing folder handler for now
        className="hidden"
        multiple
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderSelect}
        className="hidden"
        webkitdirectory=""
        multiple
      />

      <Card>
        <CardHeader>
          <CardTitle>Convert Folder</CardTitle>
          <CardDescription>
            Select a folder containing files to convert
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="format">Select Format</Label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {CONVERSION_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="path">Folder to Convert</Label>
            <div className="flex gap-2">
              <Input
                id="path"
                placeholder="No folder selected"
                value={displayPath}
                readOnly
                className="bg-slate-50 dark:bg-slate-800"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowseClick}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={handleConvert}
            disabled={isConverting || !selectedFiles || selectedFiles.length === 0}
            className="w-full"
          >
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              "Upload & Convert"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* --- STATUS AND RESULTS UI (NO CHANGES NEEDED BELOW THIS LINE) --- */}
      {(isConverting || apiResponse || phases.length > 0 || conversionError) && (
        <Card>
           <CardHeader>
            <CardTitle>Conversion Status</CardTitle>
            <CardDescription>
              {isConverting
                ? "Conversion in progress..."
                : conversionError
                ? "Conversion failed"
                : "Conversion completed"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {conversionError && (
              <div className="flex items-center space-x-2 text-red-500 bg-red-50 p-3 rounded-md">
                <AlertCircle className="h-4 w-4" />
                <span>{conversionError}</span>
              </div>
            )}

            {conversionProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Phase {currentPhase}</span>
                  <span className="text-muted-foreground">
                    {conversionProgress.converted} / {conversionProgress.total}{" "}
                    files
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Current file: {conversionProgress.currentFile}
                </div>
              </div>
            )}

            {phases.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Conversion Phases</h4>
                <ScrollArea className="max-h-96 h-full overflow-auto rounded-md border p-4">
                  {phases.map((phase) => (
                    <div key={phase.phase} className="mb-4 last:mb-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Phase {phase.phase}
                        </span>
                        <div className="flex space-x-2">
                          <Badge variant="outline" className="text-green-500">
                            <FileCheck className="h-3 w-3 mr-1" />
                            {phase.convertedFiles} converted
                          </Badge>
                          {phase.failedFiles > 0 && (
                            <Badge variant="outline" className="text-red-500">
                              <FileX className="h-3 w-3 mr-1" />
                              {phase.failedFiles} failed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {phase.totalFiles} files processed
                        {phase.startTime && phase.endTime && (
                          <span className="ml-2">
                            ({formatTimeTaken(phase.startTime, phase.endTime)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            )}

            {apiResponse && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Conversion Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Total Files</div>
                    <div className="font-medium">{apiResponse.total_files}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">
                      Successfully Converted
                    </div>
                    <div className="font-medium text-green-500">
                      {apiResponse.total_converted}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Failed</div>
                    <div className="font-medium text-red-500">
                      {apiResponse.total_failed}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Size</div>
                    <div className="font-medium">
                      {(apiResponse.total_size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                </div>

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-4 w-4" />
                    View Details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
        {/* *** FIX: ADD NULL CHECK BEFORE ACCESSING .length *** */}
        {apiResponse.converted_files && apiResponse.converted_files.length > 0 && (
            <div>
                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-green-500" />
                    Converted Files
                </h5>
                <ScrollArea className="h-32 rounded-md border p-2">
                    {apiResponse.converted_files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground py-1">
                            {file}
                        </div>
                    ))}
                </ScrollArea>
            </div>
        )}

        {/* *** FIX: ADD NULL CHECK BEFORE ACCESSING .length *** */}
        {apiResponse.failed_files && apiResponse.failed_files.length > 0 && (
            <div>
                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <FileX className="h-4 w-4 text-red-500" />
                    Failed Files
                </h5>
                <ScrollArea className="h-32 rounded-md border p-2">
                    {apiResponse.failed_files.map((file, index) => (
                        <div key={index} className="text-sm text-muted-foreground py-1">
                            {file}
                        </div>
                    ))}
                </ScrollArea>
            </div>
        )}
    </CollapsibleContent>
                </Collapsible>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </TabsContent>
  );
};

export default ConvertFolderPage;
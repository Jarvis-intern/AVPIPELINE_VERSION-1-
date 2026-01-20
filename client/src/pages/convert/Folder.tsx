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
  const [outputDir, setOutputDir] = useState<string>("");
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
    if (outputDir.trim()) {
      formData.append("output_dir", outputDir.trim());
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      // Preserve folder structure by using webkitRelativePath when available
      const rel = (file as any).webkitRelativePath as string | undefined;
      formData.append("files", file, rel && rel.length > 0 ? rel : file.name);
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

          <div className="space-y-2">
            <Label htmlFor="outputDir">Server Output Directory (optional)</Label>
            <Input
              id="outputDir"
              placeholder="e.g. /data/converted or leave blank to use temporary"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800"
            />
            <p className="text-xs text-muted-foreground">Tip: Specify an absolute path on the server to save results outside /tmp.</p>
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Status Banner */}
          <Card className={`border-l-4 ${conversionError ? 'border-l-red-500' : isConverting ? 'border-l-blue-500' : 'border-l-green-500'} shadow-sm`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {isConverting ? "Conversion in Progress" : conversionError ? "Conversion Failed" : "Conversion Completed"}
                  </CardTitle>
                  <CardDescription>
                    {isConverting ? "Please wait while we process your files..." : conversionError ? "An error occurred during the process." : "Your files have been processed successfully."}
                  </CardDescription>
                </div>
                {isConverting ? (
                  <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                ) : conversionError ? (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                ) : (
                  <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <FileCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                )}
              </div>
            </CardHeader>
            {conversionError && (
              <CardContent>
                <div className="text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/10 p-3 rounded border border-red-100 dark:border-red-900/20">
                  {conversionError}
                </div>
              </CardContent>
            )}
            {conversionProgress && (
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Progress</span>
                    <span className="text-muted-foreground">{Math.round(getProgressPercentage())}%</span>
                  </div>
                  <Progress value={getProgressPercentage()} className="h-2 w-full transition-all duration-300" />
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing: <span className="font-mono text-foreground">{conversionProgress.currentFile}</span>
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Results Section */}
          {apiResponse && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Stat Card: Total Files */}
              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <FolderOpen className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className="text-2xl font-bold">{apiResponse.total_files}</div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Files</p>
                </CardContent>
              </Card>

              {/* Stat Card: Success */}
              <Card className="shadow-sm border-green-100 dark:border-green-900/20 bg-green-50/20 dark:bg-green-900/5">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                    <FileCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">{apiResponse.total_converted}</div>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80 uppercase tracking-wider font-semibold">Converted</p>
                </CardContent>
              </Card>

              {/* Stat Card: Failed */}
              <Card className="shadow-sm border-red-100 dark:border-red-900/20 bg-red-50/20 dark:bg-red-900/5">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <FileX className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-400">{apiResponse.total_failed}</div>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 uppercase tracking-wider font-semibold">Failed</p>
                </CardContent>
              </Card>

              {/* Stat Card: Size */}
              <Card className="shadow-sm">
                <CardContent className="p-6 flex flex-col items-center text-center space-y-2">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                    <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-2xl font-bold">{(apiResponse.total_size / (1024 * 1024)).toFixed(2)} MB</div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Size</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Detailed Lists */}
          {apiResponse && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Converted Files List */}
              <Card className="h-full flex flex-col shadow-sm">
                <CardHeader className="pb-3 border-b bg-slate-50/50 dark:bg-slate-900/20">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <CardTitle className="text-base">Successful Types</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  <ScrollArea className="h-[300px] w-full p-4">
                    {apiResponse.converted_files && apiResponse.converted_files.length > 0 ? (
                      <div className="space-y-2">
                        {apiResponse.converted_files.map((file, index) => (
                          <div key={index} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm break-all border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                            <FileCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300 font-mono text-xs leading-relaxed">{file}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                        <FileCheck className="h-8 w-8" />
                        <p className="text-sm">No files converted</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Failed Files List */}
              <Card className="h-full flex flex-col shadow-sm border-red-100 dark:border-red-900/20">
                <CardHeader className="pb-3 border-b bg-red-50/10 dark:bg-red-900/5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <CardTitle className="text-base text-red-900 dark:text-red-200">Failed Conversions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 bg-red-50/5 dark:bg-red-900/5">
                  <ScrollArea className="h-[300px] w-full p-4">
                    {apiResponse.failed_files && apiResponse.failed_files.length > 0 ? (
                      <div className="space-y-2">
                        {apiResponse.failed_files.map((file, index) => (
                          <div key={index} className="group flex items-start gap-3 p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors text-sm break-all border border-red-100 dark:border-red-900/20">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <span className="text-red-700 dark:text-red-300 font-mono text-xs leading-relaxed">{file}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-2">
                        <FileCheck className="h-8 w-8 text-green-500" />
                        <p className="text-sm">No failures</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </TabsContent>
  );
};

export default ConvertFolderPage;
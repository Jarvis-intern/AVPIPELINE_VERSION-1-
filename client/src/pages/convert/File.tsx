// file: client/src/pages/convert/File.tsx

import React, { ChangeEvent, useRef, useState } from "react";
import { Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { CONVERSION_TYPES } from "@/constants/conversion";
import { useConversionStore } from "@/store/conversionStore";
import { useWebSocketStore } from "@/store/globalWebSocketStore";
import { API_URL } from "@/constants/api";
// Note: The status/results display logic could be extracted into its own component to avoid duplication.

const ConvertFilePage: React.FC = () => {
    const { selectedFormat, setSelectedFormat, isConverting, socketUserId, reset } = useConversionStore();
    const { isConnected } = useWebSocketStore();
    
    const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
    const [displayPath, setDisplayPath] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleBrowseClick = () => {
        if (fileInputRef.current) fileInputRef.current.value = "";
        fileInputRef.current?.click();
    };

    const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files && files.length > 0) {
            setSelectedFiles(files);
            setDisplayPath(files.length > 1 ? `${files.length} files selected` : files[0].name);
        }
    };

    const handleConvert = async () => {
        // (Validation logic is the same as the folder component)
        if (!selectedFiles || selectedFiles.length === 0) {
            toast.error("Please select one or more files to convert.");
            return;
        }
        if (!isConnected || !socketUserId) {
            toast.error("Not connected to the server. Please wait.");
            return;
        }
        reset();
        
        const formData = new FormData();
        formData.append("conversion_type", selectedFormat);
        formData.append("user_id", socketUserId);

        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append("files", selectedFiles[i], selectedFiles[i].name);
        }

        try {
            const response = await fetch(`${API_URL}/api/convert/upload`, {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "File upload failed");
            toast.success(result.message);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "An unknown error occurred.");
        }
    };

    return (
        <TabsContent value="file" className="space-y-4">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                multiple
            />
            <Card>
                <CardHeader>
                    <CardTitle>Convert File(s)</CardTitle>
                    <CardDescription>Select one or more files to convert</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="format">Select Format</Label>
                        <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                            <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                            <SelectContent>
                                {CONVERSION_TYPES.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="path">Files to Convert</Label>
                        <div className="flex gap-2">
                            <Input id="path" placeholder="No file(s) selected" value={displayPath} readOnly className="bg-slate-50 dark:bg-slate-800" />
                            <Button variant="outline" onClick={handleBrowseClick}>Browse Files</Button>
                        </div>
                    </div>
                    <Button onClick={handleConvert} disabled={isConverting || !selectedFiles} className="w-full">
                        {isConverting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting...</> : <><FileUp className="mr-2 h-4 w-4" />Upload & Convert</>}
                    </Button>
                </CardContent>
            </Card>
            {/* The status/results display component would go here */}
        </TabsContent>
    );
};

export default ConvertFilePage;
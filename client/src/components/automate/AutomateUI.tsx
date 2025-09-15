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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// File Selection Component
type FileSelectionProps = {
  filePath: string;
  selectedFileType: string;
  onFilePathChange: (path: string) => void;
  onFileTypeChange: (type: string) => void;
  onBrowse: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  isValid: boolean;
  isLoading: boolean;
};

export function FileSelection({
  filePath,
  selectedFileType,
  onFilePathChange,
  onFileTypeChange,
  onBrowse,
  onPrevStep,
  onNextStep,
  isValid,
  isLoading,
}: FileSelectionProps) {
  return (
    <div className="space-y-8 px-2">
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Select File or Folder</CardTitle>
            <CardDescription>
              Choose the file type and browse for your file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-3">
                <Label htmlFor="file-type">Selection Type</Label>
                <Select
                  value={selectedFileType}
                  onValueChange={onFileTypeChange}
                >
                  <SelectTrigger id="file-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">File</SelectItem>
                    <SelectItem value="folder">Folder</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2">
                <Input
                  value={filePath}
                  onChange={(e) => onFilePathChange(e.target.value)}
                  placeholder={`Select a ${selectedFileType}`}
                  className="flex-1"
                />
                <Button onClick={onBrowse} variant="outline">
                  Browse
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
        <Button onClick={onPrevStep} variant="outline">
          Back to Workflow
        </Button>
        <Button
          onClick={onNextStep}
          disabled={!isValid || isLoading}
          isLoading={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Create Task
        </Button>
      </div>
    </div>
  );
}

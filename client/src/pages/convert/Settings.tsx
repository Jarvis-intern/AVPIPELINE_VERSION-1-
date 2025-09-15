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
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";

const ConvertSettingsPage = () => {
  const [preserveOriginals, setPreserveOriginals] = useState(true);

  return (
    <TabsContent value="settings" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversion Settings</CardTitle>
          <CardDescription>
            Configure how files are processed and stored
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="preserve-originals">
                Preserve original files
              </Label>
              <p className="text-sm text-muted-foreground">
                Keep the original files after conversion
              </p>
            </div>
            <Switch
              id="preserve-originals"
              checked={preserveOriginals}
              onCheckedChange={setPreserveOriginals}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="output-format">Output location</Label>
              <p className="text-sm text-muted-foreground">
                Where to save the converted files
              </p>
            </div>
            <Select defaultValue="same">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Same as source</SelectItem>
                <SelectItem value="custom">Custom location</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="recursive">Process subfolders</Label>
              <p className="text-sm text-muted-foreground">
                Also process files in subfolders
              </p>
            </div>
            <Switch id="recursive" defaultChecked />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

export default ConvertSettingsPage;

import * as z from "zod";
import { toast } from "sonner";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AV } from "@/types";
import { useApi } from "@/hooks/useApi";
import { AVService } from "@/services/av";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAVStore } from "@/store/avs";

const avSchema = z.object({
  name: z.string().min(1, "Name is required"),
  ip_address: z.string().min(1, "IP address is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  description: z.string().optional(),
  active: z.boolean().default(false),
  status: z.boolean().default(false),
  scan_command: z.string().min(1, "Scan command is required"),
  check_command: z.string().min(1, "Check command is required"),
  info_command: z.string().min(1, "Info command is required"),
});

type AVFormData = z.infer<typeof avSchema>;

interface AVDialogProps {
  mode: "add" | "edit";
  editAVData?: AV;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AVDialog({
  mode,
  editAVData,
  open,
  onOpenChange,
}: AVDialogProps) {
  const { setAvs, avs } = useAVStore();
  const form = useForm<AVFormData>({
    resolver: zodResolver(avSchema),
    defaultValues: {
      name: "",
      ip_address: "",
      username: "",
      password: "",
      description: "",
      active: false,
      status: false,
      scan_command: "",
      check_command: "",
      info_command: "",
    },
  });

  const { loading, execute } = useApi<AV>();

  useEffect(() => {
    if (mode === "edit" && editAVData) {
      form.reset({
        name: editAVData.name,
        ip_address: editAVData.ip_address,
        username: editAVData.username,
        password: editAVData.password,
        description: editAVData.description || "",
        active: editAVData.active,
        status: editAVData.status,
        scan_command: editAVData.scan_command,
        check_command: editAVData.check_command,
        info_command: editAVData.info_command,
      });
    }
  }, [mode, editAVData, form]);

  const onSubmit = async (data: AVFormData) => {
    execute(
      () =>
        mode === "add"
          ? AVService.createAV(data)
          : AVService.updateAV(editAVData!.id!, data),
      (response) => {
        toast.success(
          `AV ${mode === "add" ? "created" : "updated"} successfully`
        );
        onOpenChange(false);

        // Update the AVs list in the store
        if (mode === "add") {
          setAvs([...avs, response]);
        } else {
          setAvs(avs.map((av) => (av.id === editAVData!.id ? response : av)));
        }

        form.reset();
      },
      (error) => {
        toast.error(error.message || `Failed to ${mode} AV`);
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) form.reset({ name: "" });
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add New AV" : "Edit AV"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ip_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Address</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scan_command"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scan Command</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="check_command"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Command</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="info_command"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Info Command</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Enable or disable this AV
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Status</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Is VM Running
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading
                  ? "Saving..."
                  : mode === "add"
                  ? "Add AV"
                  : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

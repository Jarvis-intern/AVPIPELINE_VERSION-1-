import {
  User,
  Wifi,
  Plus,
  Shield,
  Trash2,
  Computer,
  AlertCircle,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { AV } from "@/types";
import { useApi } from "@/hooks/useApi";
import { useAVStore } from "@/store/avs";
import { AVService } from "@/services/av";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AVDialog } from "./_components/av-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AVsPage: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAV, setSelectedAV] = useState<AV | null>(null);
  const { loading, execute: fetchAVs, error } = useApi<AV[]>();
  const { avs, setAvs } = useAVStore();

  const navigate = useNavigate();

  const handleDelete = async (id: string) => {
    try {
      await AVService.deleteAV(id);
      setAvs(avs.filter((av) => av.id !== id));
      toast.success("AV deleted successfully");
    } catch (error) {
      toast.error("Failed to delete AV");
    }
  };

  const getStatusVariant = (status: AV["status"]) => {
    switch (status) {
      case true:
        return "default";
      case false:
        return "destructive";
    }
  };

  useEffect(() => {
    fetchAVs(
      AVService.getAVs,
      (data) => setAvs(data),
      (err) => toast.error(err.message)
    );
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="w-full">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-3/4 mb-4" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">AV Engines</h1>
        <Button
          onClick={() => {
            setSelectedAV(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add AV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {avs.length > 0 &&
          avs.map((av) => (
            <Card
              onClick={() => navigate(`/vms/${av.id}`)}
              key={av.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Computer className="h-5 w-5" />
                    {av.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(av.status)}>
                      {av.status ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAV(av);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        av.id && handleDelete(av.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Wifi className="h-4 w-4" />
                    {av.ip_address}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    {av.username}
                  </div>
                  {av.version && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      Version: {av.version}
                    </div>
                  )}
                  {av.description && (
                    <div className="text-sm text-muted-foreground mt-2">
                      {av.description}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <AVDialog
        mode={selectedAV ? "edit" : "add"}
        editAVData={selectedAV || undefined}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
};

export default AVsPage;

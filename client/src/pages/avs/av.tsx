import { toast } from "sonner";
import { useParams } from "react-router-dom";
import React, { useEffect, useState } from "react";

import { ResourceGraph } from "./_components/resource-graph";

import { useApi } from "@/hooks/useApi";
import { AV, AVResource } from "@/types";
import { AVService } from "@/services/av";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StreamResourceRequest } from "@/proto/av_scanner";
import { VMMonitorClient } from "@/proto/av_scanner.client";
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AVDetailsPage: React.FC = () => {
  const { id } = useParams();
  const { loading: avLoading, execute: fetchAV, error } = useApi<AV>();
  const [avDetails, setAVDetails] = useState<AV | null>(null);

  const [avResources, setAvResources] = useState<AVResource>({
    cpu: [],
    disk: [],
    memory: [],
  });

  if (!id) return <ErrorBoundary />;

  const getAVResources = async () => {
    if (!avDetails) return;

    try {
      const request: StreamResourceRequest = {
        intervalSeconds: 1,
        durationSeconds: 0, // Stream indefinitely
      };

      const GRPC_TRANSPORT = new GrpcWebFetchTransport({
        baseUrl: `http://${avDetails.ip_address}:50051`,
      });
      const GRPC_CLIENT = new VMMonitorClient(GRPC_TRANSPORT);

      const stream = GRPC_CLIENT.streamResourceUsage(request);

      for await (const response of stream.responses) {
        setAvResources((prev) => {
          // Keep only last 60 data points for better performance
          const newCpu = [
            ...prev.cpu,
            { timestamp: response.lastUpdate, value: response.cpuUsage },
          ].slice(-60);
          const newDisk = [
            ...prev.disk,
            { timestamp: response.lastUpdate, value: response.diskUsage },
          ].slice(-60);
          const newMemory = [
            ...prev.memory,
            { timestamp: response.lastUpdate, value: response.memoryUsage },
          ].slice(-60);

          return {
            cpu: newCpu,
            disk: newDisk,
            memory: newMemory,
          };
        });
      }
    } catch (error) {
      toast.error(`Resource monitoring error: ${error}`);
    }
  };

  useEffect(() => {
    fetchAV(
      () => AVService.getAV(id),
      (data) => {
        setAVDetails(data);
        // Start resource monitoring after AV details are loaded
        getAVResources();
      },
      (err) => toast.error(err.message)
    );
  }, [id]);

  useEffect(() => {
    if (id && avDetails) getAVResources();
  }, [id, avDetails]);

  if (avLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error || !avDetails) {
    return <div className="p-6 text-red-500">{error || "VM not found"}</div>;
  }

  const getStatusColor = (status: boolean) => {
    if (status) return "bg-green-500";

    return "bg-red-500";
  };

  const getAVStatusColor = (status: boolean) => {
    if (status) return "bg-green-500";

    return "bg-red-500";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold mb-2">{avDetails.name}</h1>
          <div className="space-x-2">
            <Badge className={getStatusColor(avDetails.status)}>
              {avDetails.status ? "ACTIVE" : "INACTIVE"}
            </Badge>
            <Badge variant="outline">{avDetails.ip_address}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lgs">Antivirus Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="font-medium">Name:</span>
            <span>{avDetails.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Version:</span>
            <span>{avDetails.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Last Scan:</span>
            <span>{avDetails.last_update}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Status:</span>
            <Badge className={getAVStatusColor(avDetails.status)}>
              {avDetails.status ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-y-4">
        <ResourceGraph
          title="CPU Usage"
          data={avResources.cpu}
          unit="%"
          color="#0ea5e9"
        />
        <ResourceGraph
          title="Memory Usage"
          data={avResources.memory}
          unit="%"
          color="#8b5cf6"
        />
        <ResourceGraph
          title="Disk Usage"
          data={avResources.disk}
          unit="%"
          color="#f59e0b"
        />
      </div>
    </div>
  );
};

export default AVDetailsPage;

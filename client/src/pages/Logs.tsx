import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, AlertCircle, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import socket from "@/lib/socket";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type ActivityLogEntry = {
  ts: string;
  type: string;
  status?: string;
  file?: string;
  av_name?: string;
  task_id?: string;
  message?: string;
};

export function Logs() {
  const [items, setItems] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ops, setOps] = useState<any[]>([]);
  const loadOps = async () => {
    try {
  const res = await api.get<any>("/api/operation-logs?limit=300");
      setOps(res.items || []);
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    try {
  const res = await api.get<any>("/api/activity/recent?limit=200");
      setItems(res.items || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadOps();
    const handleRealtime = (data: any) => {
      if (data.type && data.ts) {
        setItems(prev => [data as ActivityLogEntry, ...prev].slice(0, 500));
      }
    };
    socket.on("activity_event", handleRealtime);
    return () => {
      socket.off("activity_event", handleRealtime);
    };
  }, []);

  // Simple renderer for ops
  const renderOpRow = (r: any, i: number) => (
    <tr key={i} className="hover:bg-slate-50">
      <td className="px-3 py-1 text-xs">{new Date(r.ts).toLocaleTimeString()}</td>
      <td className="px-3 py-1 text-xs">{r.kind}</td>
      <td className="px-3 py-1 text-xs truncate max-w-[220px]">{r.file || "-"}</td>
      <td className="px-3 py-1 text-xs">{r.status || r.result || r.action || "-"}</td>
      <td className="px-3 py-1 text-xs">{r.conversion_type || r.av_name || r.stage || "-"}</td>
    </tr>
  );

  const renderRow = (r: ActivityLogEntry, i: number) => (
    <tr key={i} className="hover:bg-slate-50">
      <td className="px-4 py-1 text-xs">{new Date(r.ts).toLocaleTimeString()}</td>
      <td className="px-4 py-1 text-xs capitalize">{r.type}</td>
      <td className="px-4 py-1 text-xs">{r.status || "-"}</td>
      <td className="px-4 py-1 text-xs truncate max-w-[260px]">{r.file || r.message || "-"}</td>
      <td className="px-4 py-1 text-xs">{r.av_name || r.task_id || "-"}</td>
    </tr>
  );

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <h1 className="text-2xl font-bold mb-4">Logs</h1>
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800/40">
              <span className="text-sm font-medium">Recent Events</span>
              <button onClick={load} className="text-xs text-blue-600">Refresh</button>
            </div>
            {loading ? (
              <div className="p-4 text-sm text-slate-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No activity yet.</div>
            ) : (
              <table className="w-full text-left">
                <thead className="text-[11px] uppercase bg-slate-100 dark:bg-slate-800/60">
                  <tr>
                    <th className="px-4 py-2">Time</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">File / Message</th>
                    <th className="px-4 py-2">AV / Task</th>
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {items.map(renderRow)}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="operations">
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
              <span className="text-sm font-medium">Operation Events</span>
              <button onClick={loadOps} className="text-xs text-blue-600">Refresh</button>
            </div>
            <table className="w-full text-left">
              <thead className="text-[11px] uppercase bg-slate-100">
                <tr>
                  <th className="px-3 py-1">Time</th>
                  <th className="px-3 py-1">Kind</th>
                  <th className="px-3 py-1">File</th>
                  <th className="px-3 py-1">Status</th>
                  <th className="px-3 py-1">Meta</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {ops.map(renderOpRow)}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useEffect, useState } from "react";
import {
  Files,
  CheckCircle,
  AlertTriangle,
  Clock,
  Mail,
  Inbox,
  FileArchive,
  FileText,
  RefreshCw,
  ArrowRight,
  FileOutput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export function Dashboard() {
  // State for dashboard data
  const [conversionStats, setConversionStats] = useState([
    { label: "EML Files", value: "-", icon: Mail, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300" },
    { label: "MSG Files", value: "-", icon: Inbox, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300" },
    { label: "PST Archives", value: "-", icon: FileArchive, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300" },
    { label: "Word Docs", value: "-", icon: FileText, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-300" },
  ]);
  const [stats, setStats] = useState([
    { label: "Total Files", value: "-", icon: Files, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300" },
    { label: "Scanned", value: "-", icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-300" },
    { label: "Infected", value: "-", icon: AlertTriangle, color: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" },
    { label: "In Progress", value: "-", icon: Clock, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300" },
  ]);
  const [systemStatus, setSystemStatus] = useState({
    cpu: 0,
    memory: 0,
    disk: 0,
    service: "Running",
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        // System status
  const sys = await api.get<any>("/api/system-info/system-usage");
        setSystemStatus({
          cpu: sys.cpu?.cpu_usage ?? 0,
          memory: sys.memory?.used_memory && sys.memory?.total_memory ? Math.round((sys.memory.used_memory / sys.memory.total_memory) * 100) : 0,
          disk: sys.disk?.used_disk && sys.disk?.total_disk ? Math.round((sys.disk.used_disk / sys.disk.total_disk) * 100) : 0,
          service: "Running",
        });

        // Conversion stats (example: get all conversions and aggregate)
  const conversions = await api.get<any[]>("/api/conversion");
        // You may need to adjust this aggregation based on your backend data structure
        setConversionStats([
          { ...conversionStats[0], value: conversions.filter((c) => c.selected_format === "eml").length.toString() },
          { ...conversionStats[1], value: conversions.filter((c) => c.selected_format === "msg").length.toString() },
          { ...conversionStats[2], value: conversions.filter((c) => c.selected_format === "pst").length.toString() },
          { ...conversionStats[3], value: conversions.filter((c) => c.selected_format === "docx" || c.selected_format === "doc").length.toString() },
        ]);

        // Security stats (example: get all scan details and aggregate)
  const scans = await api.get<any[]>("/api/scan-details");
        setStats([
          { ...stats[0], value: scans.reduce((acc, s) => acc + (s.files_scanned_count || 0), 0).toString() },
          { ...stats[1], value: scans.length.toString() },
          { ...stats[2], value: scans.reduce((acc, s) => acc + (s.threats_files_count || 0), 0).toString() },
          { ...stats[3], value: scans.filter((s) => s.status === "IN_PROGRESS").length.toString() },
        ]);

        // Recent activity (example: show last 3 scans and conversions)
        const recent = [
          ...scans.slice(-2).map((s) => ({
            type: "scan",
            title: "Scan completed",
            desc: `${s.files_scanned_count} files scanned, ${s.threats_files_count} threats detected`,
            time: s.scan_end_time || s.time_of_scan_completion,
          })),
          ...conversions.slice(-1).map((c) => ({
            type: "conversion",
            title: "Conversion completed",
            desc: `${c.converted_files || 0} files converted to ${c.selected_format?.toUpperCase() || "unknown"} format`,
            time: c.updated_at,
          })),
        ];
        setRecentActivity(recent.reverse());
      } catch (e) {
        // handle error, optionally set fallback UI
      }
    }
    fetchDashboardData();
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      {/* Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Conversion Section */}
        <Card className="overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">File Conversion</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>View Details</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-0">
              {conversionStats.map((stat, i) => (
                <div key={i} className="p-4 flex items-start">
                  <div className={cn(stat.color, "w-10 h-10 rounded-md flex items-center justify-center mr-3")}> <stat.icon className="h-5 w-5" /> </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-sm text-slate-500 dark:text-slate-400">Last conversion: --</div>
              <Button variant="link" size="sm" className="p-0 h-auto text-blue-600 dark:text-blue-400 font-medium">
                Convert New Files
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Status Section */}
        <Card className="overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
          <CardHeader className="pb-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">Security Status</CardTitle>
            </div>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" />
              <span>View Details</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 gap-0">
              {stats.map((stat, i) => (
                <div key={i} className="p-4 flex items-start">
                  <div className={cn(stat.color, "w-10 h-10 rounded-md flex items-center justify-center mr-3")}> <stat.icon className="h-5 w-5" /> </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex justify-between items-center border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-sm text-slate-500 dark:text-slate-400">Last scan: --</div>
              <Button variant="link" size="sm" className="p-0 h-auto text-green-600 dark:text-green-400 font-medium">
                Start New Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Status & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* System Status */}
        <Card className="shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <CardHeader className="pb-3 border-b border-slate-200 dark:border-slate-700">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">System Status</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">CPU Usage</span>
                <span className="text-sm font-medium text-slate-800 dark:text-white">{systemStatus.cpu}%</span>
              </div>
              <Progress value={systemStatus.cpu} className="h-2 bg-slate-200 dark:bg-slate-700" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Memory Usage</span>
                <span className="text-sm font-medium text-slate-800 dark:text-white">{systemStatus.memory}%</span>
              </div>
              <Progress value={systemStatus.memory} className="h-2 bg-slate-200 dark:bg-slate-700" />

              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Disk Usage</span>
                <span className="text-sm font-medium text-slate-800 dark:text-white">{systemStatus.disk}%</span>
              </div>
              <Progress value={systemStatus.disk} className="h-2 bg-slate-200 dark:bg-slate-700" />

              <div className="pt-2 mt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Service status:</span>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                    {systemStatus.service}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="shadow-sm border border-slate-200 dark:border-slate-700 lg:col-span-2 overflow-hidden">
          <CardHeader className="pb-3 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-white">Recent Activity</CardTitle>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 dark:text-slate-300">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {recentActivity.length === 0 && (
                <div className="p-4 text-slate-500 dark:text-slate-400">No recent activity.</div>
              )}
              {recentActivity.map((item, i) => (
                <div key={i} className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div className={
                    item.type === "scan"
                      ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300 p-2 rounded-full"
                      : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 p-2 rounded-full"
                  }>
                    {item.type === "scan" ? <CheckCircle className="h-5 w-5" /> : <FileOutput className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">{item.title}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{item.desc}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{item.time ? new Date(item.time).toLocaleString() : "--"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <Button variant="ghost" size="sm" className="w-full text-slate-600 dark:text-slate-300 justify-center gap-1.5">
              <span>View all activity</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
} 
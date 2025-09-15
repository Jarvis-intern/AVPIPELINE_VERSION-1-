import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, AlertCircle, Shield, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function Logs() {
  // Sample log data
  const sampleLogs = [
    { 
      id: 1, 
      filename: 'document.docx', 
      scanDate: '2024-04-09 14:32', 
      status: 'clean', 
      engine: 'Windows Defender',
      details: 'No threats detected'
    },
    { 
      id: 2, 
      filename: 'invoice.pdf', 
      scanDate: '2024-04-09 13:45', 
      status: 'clean', 
      engine: 'ClamAV',
      details: 'No threats detected'
    },
    { 
      id: 3, 
      filename: 'attachment.exe', 
      scanDate: '2024-04-09 11:28', 
      status: 'malicious', 
      engine: 'ESET',
      details: 'Trojan detected: Win32/Malware.ABC'
    },
    { 
      id: 4, 
      filename: 'download.zip', 
      scanDate: '2024-04-08 16:04', 
      status: 'suspicious', 
      engine: 'Trend Micro',
      details: 'Suspicious behavior detected'
    },
    { 
      id: 5, 
      filename: 'report.xlsx', 
      scanDate: '2024-04-08 09:12', 
      status: 'clean', 
      engine: 'Windows Defender',
      details: 'No threats detected'
    },
  ];

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'clean':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
            <CheckCircle className="h-3 w-3 mr-1" /> Clean
          </Badge>
        );
      case 'malicious':
        return (
          <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
            <AlertCircle className="h-3 w-3 mr-1" /> Malicious
          </Badge>
        );
      case 'suspicious':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
            <Shield className="h-3 w-3 mr-1" /> Suspicious
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <Clock className="h-3 w-3 mr-1" /> Unknown
          </Badge>
        );
    }
  };
  
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 max-w-7xl">
      <h1 className="text-2xl font-bold mb-6">Scan Logs</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Recent Scan Results</CardTitle>
          <CardDescription>
            Review the results of recent file scans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3">
                    File
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3">
                    Engine
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3">
                    Status
                  </th>
                  <th className="text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider px-6 py-3">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {sampleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-4 w-4 text-slate-400 mr-2" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {log.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {log.scanDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {log.engine}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 
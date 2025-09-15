import React from 'react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface InfectedFile {
  file_path: string;
  virus_name: string;
  file_size: number;
  last_modified: string;
  detection_time: string;
}

interface ScanResult {
  success: boolean;
  infected_files: number;
  total_files: number;
  total_size: number;
  infected_files_list: InfectedFile[];
  error_output?: string;
  log_output?: string;
  scan_duration: string;
  scan_type: string;
  scan_start_time: string;
  scan_end_time: string;
}

interface ScanResultsProps {
  result: ScanResult;
}

export const ScanResults: React.FC<ScanResultsProps> = ({ result }) => {
  const formatFileSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Summary Section */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Scan Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Files</p>
              <p className="text-2xl font-semibold">{result.total_files}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Infected Files</p>
              <p className="text-2xl font-semibold text-red-500">{result.infected_files}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Size</p>
              <p className="text-2xl font-semibold">{formatFileSize(result.total_size)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Duration</p>
              <p className="text-2xl font-semibold">{result.scan_duration}</p>
            </div>
          </div>
        </div>

        {/* Scan Details */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Scan Details</h3>
          <div className="space-y-2">
            <p><span className="font-medium">Scan Type:</span> {result.scan_type}</p>
            <p><span className="font-medium">Start Time:</span> {formatDate(result.scan_start_time)}</p>
            <p><span className="font-medium">End Time:</span> {formatDate(result.scan_end_time)}</p>
            <p><span className="font-medium">Status:</span> 
              <Badge variant={result.success ? "default" : "destructive"} className="ml-2">
                {result.success ? "Success" : "Failed"}
              </Badge>
            </p>
          </div>
        </div>

        {/* Infected Files List */}
        {result.infected_files > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Infected Files</h3>
            <div className="space-y-4">
              {result.infected_files_list.map((file, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-2">
                    <p className="font-medium text-red-500">{file.file_path}</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <p><span className="text-gray-500">Virus:</span> {file.virus_name}</p>
                      <p><span className="text-gray-500">Size:</span> {formatFileSize(file.file_size)}</p>
                      <p><span className="text-gray-500">Last Modified:</span> {formatDate(file.last_modified)}</p>
                      <p><span className="text-gray-500">Detected:</span> {formatDate(file.detection_time)}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Error Output */}
        {result.error_output && (
          <div>
            <h3 className="text-xl font-semibold mb-4">Errors</h3>
            <Card className="p-4 bg-red-50">
              <pre className="text-sm text-red-700 whitespace-pre-wrap">{result.error_output}</pre>
            </Card>
          </div>
        )}
      </div>
    </Card>
  );
}; 
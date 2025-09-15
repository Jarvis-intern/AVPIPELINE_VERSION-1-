import {
  Clock,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AVParsedResult } from "@/types";
import { formatDateTime } from "@/lib/helper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const ScanResultsCard = ({
  result,
  isScanning,
  scanStartTime,
  scanEndTime,
}: {
  result: AVParsedResult;
  isScanning: boolean;
  scanStartTime?: string;
  scanEndTime?: string;
}) => {
  const [infectedPage, setInfectedPage] = useState(1);
  const [errorPage, setErrorPage] = useState(1);
  const [infectedItemsPerPage, setInfectedItemsPerPage] = useState<number>(10);
  const [errorItemsPerPage, setErrorItemsPerPage] = useState<number>(10);
  const [isInfectedExpanded, setIsInfectedExpanded] = useState(false);
  const [isErrorExpanded, setIsErrorExpanded] = useState(false);

  const getScanStatus = () => {
    if (isScanning)
      return { label: "Scanning...", variant: "default" as const };
    if (result.errorFiles.length > 0)
      return { label: "Error", variant: "destructive" as const };
    if (result.infectedFiles.length > 0)
      return { label: "Infected", variant: "destructive" as const };
    return { label: "Clean", variant: "success" as const };
  };

  const status = getScanStatus();

  const totalInfectedPages = Math.ceil(
    result.infectedFiles.length / infectedItemsPerPage
  );
  const totalErrorPages = Math.ceil(
    result.errorFiles.length / errorItemsPerPage
  );

  const paginatedInfectedFiles = result.infectedFiles.slice(
    (infectedPage - 1) * infectedItemsPerPage,
    infectedPage * infectedItemsPerPage
  );

  const paginatedErrorFiles = result.errorFiles.slice(
    (errorPage - 1) * errorItemsPerPage,
    errorPage * errorItemsPerPage
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Scan Results</CardTitle>
          <div className="flex items-center space-x-2">
            {isScanning && <Loader2 className="h-4 w-4 animate-spin" />}
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Total Scanned Files:</span>
              <span className="font-semibold">
                {result.totalScannedFiles.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>Infected Files:</span>
              <span className="font-semibold">
                {result.infectedFiles.length}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>Error Files:</span>
              <span className="font-semibold">{result.errorFiles.length}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Start Time:</span>
              <span className="font-semibold">
                {scanStartTime ? formatDateTime(scanStartTime) : "N/A"}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>End Time:</span>
              <span className="font-semibold">
                {scanEndTime ? formatDateTime(scanEndTime) : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {result.infectedFiles.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsInfectedExpanded(!isInfectedExpanded)}
              className="h-8 px-2 w-full justify-start"
            >
              {isInfectedExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 mr-2" />
              )}
              <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
              <span className="font-semibold">
                Infected Files ({result.infectedFiles.length})
              </span>
            </Button>

            {isInfectedExpanded && (
              <div className="border rounded-lg">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0">
                      <TableRow>
                        <TableHead>File Path</TableHead>
                        <TableHead>Virus Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedInfectedFiles.map((file, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium text-red-600 text-xs">
                            {file.filePath}
                          </TableCell>
                          <TableCell className="text-xs">
                            {file.virusName}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalInfectedPages > 1 && (
                  <div className="flex items-center justify-between space-x-2 p-2 border-t">
                    <div className="flex space-x-2 items-center">
                      <span className="text-sm">Items per page:</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 rounded"
                          >
                            {infectedItemsPerPage}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => setInfectedItemsPerPage(10)}
                          >
                            10
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setInfectedItemsPerPage(20)}
                          >
                            20
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setInfectedItemsPerPage(50)}
                          >
                            50
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setInfectedItemsPerPage(100)}
                          >
                            100
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex space-x-4 items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 rounded"
                        onClick={() =>
                          setInfectedPage((p) => Math.max(1, p - 1))
                        }
                        disabled={infectedPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {infectedPage} of {totalInfectedPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 rounded"
                        onClick={() =>
                          setInfectedPage((p) =>
                            Math.min(totalInfectedPages, p + 1)
                          )
                        }
                        disabled={infectedPage === totalInfectedPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {result.errorFiles.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsErrorExpanded(!isErrorExpanded)}
              className="h-8 px-2 w-full justify-start"
            >
              {isErrorExpanded ? (
                <ChevronDown className="h-4 w-4 mr-2" />
              ) : (
                <ChevronRightIcon className="h-4 w-4 mr-2" />
              )}
              <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
              <span className="font-semibold">
                Error Files ({result.errorFiles.length})
              </span>
            </Button>

            {isErrorExpanded && (
              <div className="border rounded-lg">
                <div className="max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted sticky top-0">
                      <TableRow>
                        <TableHead>File Path</TableHead>
                        <TableHead>Error Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedErrorFiles.map((errorFiles, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-red-600 text-xs">
                            {errorFiles.filePath}
                          </TableCell>
                          <TableCell className="text-red-600 text-xs">
                            {errorFiles.errorMesg}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalErrorPages > 1 && (
                  <div className="flex items-center justify-between p-2 border-t">
                    <div className="flex space-x-2 items-center">
                      <span className="text-sm">Items per page:</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 rounded"
                          >
                            {errorItemsPerPage}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem
                            onClick={() => setErrorItemsPerPage(10)}
                          >
                            10
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setErrorItemsPerPage(20)}
                          >
                            20
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setErrorItemsPerPage(50)}
                          >
                            50
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setErrorItemsPerPage(100)}
                          >
                            100
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex space-x-4 items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 rounded"
                        onClick={() => setErrorPage((p) => Math.max(1, p - 1))}
                        disabled={errorPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {errorPage} of {totalErrorPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-6 rounded"
                        onClick={() =>
                          setErrorPage((p) => Math.min(totalErrorPages, p + 1))
                        }
                        disabled={errorPage === totalErrorPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

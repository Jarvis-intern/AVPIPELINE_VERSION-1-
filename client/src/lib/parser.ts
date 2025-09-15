import { AVParsedResult, ErrorFile, InfectedFile } from "@/types";

const isLikelyPath = (line: string) => {
  // Check for drive letter paths (C:\path\to\file)
  const driveLetterPattern = /[A-Za-z]:[\\\/].+/;

  // Check for UNC paths (\\?\UNC\server\share\path\to\file)
  const uncPattern = /\\\\\?\\UNC\\.+/;

  // Check for regular UNC paths (\\server\share\path\to\file)
  const regularUncPattern = /\\\\[^\\]+\\[^\\]+.+/;

  return (
    driveLetterPattern.test(line) ||
    uncPattern.test(line) ||
    regularUncPattern.test(line)
  );
};
const sanitizeUTF8 = (input: string) => input.replace(/[^\x00-\x7F]+/g, "");

export function clamAVParser(log: string): AVParsedResult {
  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  const lines = log.split("\n").filter((line) => line.trim() !== "");

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();
    const lastColonIndex = content.lastIndexOf(":");
    if (lastColonIndex === -1) continue;

    const filePath = sanitizeUTF8(content.slice(0, lastColonIndex).trim());
    const status = sanitizeUTF8(content.slice(lastColonIndex + 1).trim());

    if (!isLikelyPath(filePath)) continue;
    // Count every scanned file
    totalScannedFiles.push(filePath);

    if (status.toUpperCase() === "OK") {
      continue;
    } else if (status.toUpperCase().endsWith("FOUND")) {
      const virusName = status.replace(/FOUND$/i, "").trim();
      infectedFiles.push({ filePath, virusName });
    } else {
      errorFiles.push({ filePath, errorMesg: status });
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function esetAVParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    const cleanLine = sanitizeUTF8(line);

    // Ignore summary and non-file lines
    if (
      cleanLine.includes("Scan started at:") ||
      cleanLine.includes("Scan completed at:") ||
      cleanLine.startsWith("Total:") ||
      cleanLine.startsWith("Detected:") ||
      cleanLine.startsWith("Scan time:") ||
      cleanLine.startsWith("Cleaned:") ||
      cleanLine.includes("MIME") // Ignore MIME log lines
    ) {
      continue;
    }

    // Extract file path and result/info from the line
    const match = cleanLine.match(
      /name="([^"]+)", result="([^"]*)", action="[^"]*", info="([^"]*)"/
    );
    if (match) {
      const [, filePath, result, info] = match;
      const sanitizedPath = sanitizeUTF8(filePath);

      // Only count if it looks like a real path
      if (!isLikelyPath(sanitizedPath)) continue;

      // Count every scanned file
      totalScannedFiles.push(sanitizedPath);

      // If result is not empty, it's an infected file
      if (result) {
        infectedFiles.push({
          filePath: sanitizedPath,
          virusName: sanitizeUTF8(result),
        });
      }

      // If info is not empty, it's an error file
      if (info) {
        errorFiles.push({ filePath: sanitizedPath, errorMesg: info });
      }
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function kasperskyAVParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();

    // Skip empty lines
    if (!content) continue;
    // Skip progress lines that don't contain file information
    if (content.startsWith("Progress") && !content.includes("\\\\")) continue;
    // Extract file path from the line
    // Look for UNC path pattern: \\DESKTOP-xxx\path\to\file
    const filePathMatch = content.match(
      /\\\\([^\\]+)\\(.+?)(?:\s+(ok|skipped|suspicion|password protected|error|failed|blocked|quarantined|deleted|cleaned|moved|renamed|ignored|excluded|timeout|access denied|not found|corrupted|damaged|invalid|unsupported|unknown|other))?$/i
    );

    if (!filePathMatch) continue;

    const [, server, filePath, status] = filePathMatch;
    const fullFilePath = `\\\\${server}\\${filePath}`;

    // Count every scanned file
    if (!totalScannedFiles.includes(fullFilePath)) {
      totalScannedFiles.push(fullFilePath);
    }

    // Check for virus detection (suspicion HEUR)
    const virusMatch = content.match(
      /suspicion\s+(HEUR:[^\s]+(?:\s+[^\s]+)*)/i
    );
    if (virusMatch) {
      const virusName = virusMatch[1].trim();
      infectedFiles.push({
        filePath: fullFilePath,
        virusName: virusName,
      });
      continue;
    }

    // Check for other statuses that indicate errors
    const lowerStatus = status?.toLowerCase();
    if (
      lowerStatus &&
      lowerStatus !== "ok" &&
      lowerStatus !== "skipped" &&
      !lowerStatus.includes("heur")
    ) {
      errorFiles.push({
        filePath: fullFilePath,
        errorMesg: status || "Unknown error",
      });
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function emsiAVParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();

    // Skip empty lines
    if (!content) continue;

    // Skip summary lines that start with #
    if (content.startsWith("#")) continue;

    // Skip lines that don't look like file paths
    if (!content.match(/^[A-Za-z]:[\\\/].+/)) continue;

    // Check for virus detection
    const virusMatch = content.match(/^(.+?)\s+detected:\s+(.+)$/);
    if (virusMatch) {
      const [, filePath, virusName] = virusMatch;
      const baseFilePath = filePath.trim();

      // Add to totalScannedFiles if not already present
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }

      // Add to infected files
      const existingIndex = infectedFiles.findIndex(
        (f) => f.filePath === baseFilePath
      );
      if (existingIndex === -1) {
        infectedFiles.push({
          filePath: baseFilePath,
          virusName: virusName.trim(),
        });
      } else {
        const existing = infectedFiles[existingIndex];
        if (!existing.virusName.includes(virusName.trim())) {
          existing.virusName += `, ${virusName.trim()}`;
        }
      }
      continue;
    }

    // If no virus detected, it's a clean file
    if (!totalScannedFiles.includes(content)) {
      totalScannedFiles.push(content);
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function comodoAVParser(_: string): AVParsedResult {
  // TODO: Implement parser for Comodo
  return {
    totalScannedFiles: [],
    infectedFiles: [],
    errorFiles: [],
  };
}

export function avastAVParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();

    // Skip empty lines
    if (!content) continue;

    // Skip summary lines that start with #
    if (content.startsWith("#")) continue;

    // Skip lines that don't look like file paths
    if (!content.match(/^[A-Za-z]:[\\\/].+/)) continue;

    // First check for OK status
    const okMatch = content.match(/\s+OK$/);
    if (okMatch) {
      // Get the file path by removing the OK status
      const filePath = content.slice(0, okMatch.index).trim();

      // Remove :Zone.Identifier for counting to avoid duplicates
      const baseFilePath = filePath.replace(/:Zone\.Identifier$/, "");
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }
      continue;
    }

    // Then check for ERR status
    const errMatch = content.match(/\s+(ERR.*)$/);
    if (errMatch) {
      const filePath = content.slice(0, errMatch.index).trim();

      // Remove :Zone.Identifier for counting
      const baseFilePath = filePath.replace(/:Zone\.Identifier$/, "");
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }

      errorFiles.push({
        filePath: baseFilePath,
        errorMesg: errMatch[1],
      });
      continue;
    }

    // Finally check for virus detection
    // Look for a colon followed by virus name at the end of the line
    const virusMatch = content.match(/^(.+?)([A-Za-z0-9-]+):(.+)$/);
    if (virusMatch) {
      const [, filePath, virusType, virusName] = virusMatch;
      const baseFilePath = filePath.trim();

      // Add to totalScannedFiles if not already present
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }

      // Add to infected files
      const existingIndex = infectedFiles.findIndex(
        (f) => f.filePath === baseFilePath
      );

      if (existingIndex === -1) {
        infectedFiles.push({
          filePath: baseFilePath,
          virusName: `${virusType}:${virusName.trim()}`,
        });
      } else {
        const existing = infectedFiles[existingIndex];
        const newVirusName = `${virusType}:${virusName.trim()}`;
        if (!existing.virusName.includes(newVirusName)) {
          existing.virusName += `, ${newVirusName}`;
        }
      }
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function windowsDefenderAVParser(_: string): AVParsedResult {
  // TODO: Implement parser for Windows Defender
  return {
    totalScannedFiles: [],
    infectedFiles: [],
    errorFiles: [],
  };
}

export function sophosAVParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();

    // Skip empty lines
    if (!content) continue;

    // Extract file path and detection info
    const filePathMatch = content.match(
      /^(.+?)(?:\s*\((?:\d+%|Detected as.+)\))?$/
    );
    if (!filePathMatch) continue;

    const filePath = filePathMatch[1].trim();

    // Skip if not a valid path
    if (!filePath.startsWith("\\\\")) continue;

    // Count every scanned file
    totalScannedFiles.push(filePath);

    // Check for virus detection
    const detectionMatch = content.match(/Detected as '(.+?)' type: '(.+?)'/);
    if (detectionMatch) {
      const [, virusName, virusType] = detectionMatch;
      infectedFiles.push({
        filePath,
        virusName: `${virusName} (${virusType})`,
      });
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

export function fSecureAVParser(_: string): AVParsedResult {
  // TODO: Implement parser for FSecure
  return {
    totalScannedFiles: [],
    infectedFiles: [],
    errorFiles: [],
  };
}

export function avgParser(log: string): AVParsedResult {
  const lines = log
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const totalScannedFiles: string[] = [];
  const infectedFiles: InfectedFile[] = [];
  const errorFiles: ErrorFile[] = [];

  for (const line of lines) {
    // Split timestamp and log content
    const [_, rawContent] = line.includes("|")
      ? line.split("|").map((s) => s.trim())
      : [null, line.trim()];

    const content = rawContent.trim();

    // Skip empty lines
    if (!content) continue;

    // Skip summary lines that start with #
    if (content.startsWith("#")) continue;

    // Skip lines that don't look like file paths
    if (!content.match(/^[A-Za-z]:[\\\/].+/)) continue;

    // First check for OK status
    const okMatch = content.match(/\s+OK$/);
    if (okMatch) {
      // Get the file path by removing the OK status
      const filePath = content.slice(0, okMatch.index).trim();

      // Remove :Zone.Identifier for counting to avoid duplicates
      const baseFilePath = filePath.replace(/:Zone\.Identifier$/, "");
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }
      continue;
    }

    // Then check for ERR status
    const errMatch = content.match(/\s+(ERR.*)$/);
    if (errMatch) {
      const filePath = content.slice(0, errMatch.index).trim();

      // Remove :Zone.Identifier for counting
      const baseFilePath = filePath.replace(/:Zone\.Identifier$/, "");
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }

      errorFiles.push({
        filePath: baseFilePath,
        errorMesg: errMatch[1],
      });
      continue;
    }

    // Finally check for virus detection
    // Look for a colon followed by virus name at the end of the line
    const virusMatch = content.match(/^(.+?)([A-Za-z0-9-]+):(.+)$/);
    if (virusMatch) {
      const [, filePath, virusType, virusName] = virusMatch;
      const baseFilePath = filePath.trim();

      // Add to totalScannedFiles if not already present
      if (!totalScannedFiles.includes(baseFilePath)) {
        totalScannedFiles.push(baseFilePath);
      }

      // Add to infected files
      const existingIndex = infectedFiles.findIndex(
        (f) => f.filePath === baseFilePath
      );

      if (existingIndex === -1) {
        infectedFiles.push({
          filePath: baseFilePath,
          virusName: `${virusType}:${virusName.trim()}`,
        });
      } else {
        const existing = infectedFiles[existingIndex];
        const newVirusName = `${virusType}:${virusName.trim()}`;
        if (!existing.virusName.includes(newVirusName)) {
          existing.virusName += `, ${newVirusName}`;
        }
      }
    }
  }

  return {
    totalScannedFiles,
    infectedFiles,
    errorFiles,
  };
}

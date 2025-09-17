package logger

import (
    "bufio"
    "encoding/json"
    "errors"
    "os"
    "path/filepath"
    "sync"
    "time"
)

// OperationRecord is the unified structured log line (JSONL).
type OperationRecord struct {
    TS            string         `json:"ts"`
    Kind          string         `json:"kind"` // conversion_file | scan_file | automation_stage | extraction_file | automation_action
    TaskID        string         `json:"task_id,omitempty"`
    File          string         `json:"file,omitempty"`
    FromExt       string         `json:"from_ext,omitempty"`
    ToExt         string         `json:"to_ext,omitempty"`
    Status        string         `json:"status,omitempty"`
    ConversionType string        `json:"conversion_type,omitempty"`
    AVName        string         `json:"av_name,omitempty"`
    Result        string         `json:"result,omitempty"`       // clean | infected | error
    ThreatName    string         `json:"threat_name,omitempty"`  // detection signature
    Stage         string         `json:"stage,omitempty"`
    Action        string         `json:"action,omitempty"`       // started | completed | converted | scanned | extracted
    FilesProcessed int           `json:"files_processed,omitempty"`
    Success       *bool          `json:"success,omitempty"`
    Meta          map[string]any `json:"meta,omitempty"`
}

var (
    opMu          sync.Mutex
    opDate        string
    opWriter      *bufio.Writer
    opFile        *os.File
    opBaseDir     = "logs"
    opPattern     = "operations" // operations-YYYYMMDD.jsonl
)

// InitOperationLogger initializes (call from main).
func InitOperationLogger() error {
    opMu.Lock()
    defer opMu.Unlock()
    opDate = time.Now().Format("20060102")
    if err := os.MkdirAll(opBaseDir, 0o755); err != nil {
        return err
    }
    return openOpFileLocked()
}

func openOpFileLocked() error {
    if opWriter != nil {
        opWriter.Flush()
        opFile.Close()
    }
    path := filepath.Join(opBaseDir, opPattern+"-"+opDate+".jsonl")
    f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
    if err != nil {
        return err
    }
    opFile = f
    opWriter = bufio.NewWriter(f)
    return nil
}

func rotateOpLocked() error {
    today := time.Now().Format("20060102")
    if today == opDate {
        return nil
    }
    opWriter.Flush()
    opFile.Close()
    opDate = today
    return openOpFileLocked()
}

// appendOperation writes one record.
func appendOperation(rec OperationRecord) error {
    opMu.Lock()
    defer opMu.Unlock()
    if opWriter == nil {
        return errors.New("operation logger not initialized")
    }
    if err := rotateOpLocked(); err != nil {
        return err
    }
    if rec.TS == "" {
        rec.TS = time.Now().UTC().Format(time.RFC3339)
    }
    b, _ := json.Marshal(rec)
    if _, err := opWriter.Write(append(b, '\n')); err != nil {
        return err
    }
    return opWriter.Flush()
}

// Public helpers

func LogConversion(taskID, filePath, fromExt, toExt, status, convType string) {
    _ = appendOperation(OperationRecord{
        Kind:           "conversion_file",
        TaskID:         taskID,
        File:           filePath,
        FromExt:        fromExt,
        ToExt:          toExt,
        Status:         status,
        ConversionType: convType,
        Action:         "converted",
    })
}

func LogScan(taskID, filePath, avName, result, threat string) {
    _ = appendOperation(OperationRecord{
        Kind:       "scan_file",
        TaskID:     taskID,
        File:       filePath,
        AVName:     avName,
        Result:     result,
        ThreatName: threat,
        Action:     "scanned",
    })
}

func LogAutomationStage(taskID, stage, action string, filesProcessed int) {
    _ = appendOperation(OperationRecord{
        Kind:           "automation_stage",
        TaskID:         taskID,
        Stage:          stage,
        Action:         action,
        FilesProcessed: filesProcessed,
    })
}

func LogExtractionFile(taskID, file string, success bool) {
    _ = appendOperation(OperationRecord{
        Kind:    "extraction_file",
        TaskID:  taskID,
        File:    file,
        Action:  "extracted",
        Success: &success,
    })
}

// LogConversionSummary records a summary (even if zero files processed)
func LogConversionSummary(taskID string, total, converted, failed int, status string, convType string) {
    _ = appendOperation(OperationRecord{
        Kind:           "conversion_summary",
        TaskID:         taskID,
        Status:         status,
        ConversionType: convType,
        FilesProcessed: total,
        Meta: map[string]any{
            "converted": converted,
            "failed":    failed,
        },
        Action: "completed",
    })
}
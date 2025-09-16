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

type ActivityRecord struct {
    TS     string                 `json:"ts"`
    Type   string                 `json:"type"`
    TaskID string                 `json:"task_id,omitempty"`
    File   string                 `json:"file,omitempty"`
    Status string                 `json:"status,omitempty"`
    AVName string                 `json:"av_name,omitempty"`
    Meta   map[string]any         `json:"meta,omitempty"`
    Msg    string                 `json:"message,omitempty"`
}

var (
    baseDir      = "logs"
    fileName     = "activity.log"
    mu           sync.Mutex
    currentDate  string
    activeWriter *bufio.Writer
    activeFile   *os.File
)

func InitActivityLogger() error {
    mu.Lock()
    defer mu.Unlock()
    currentDate = time.Now().Format("20060102")
    if err := os.MkdirAll(baseDir, 0o755); err != nil {
        return err
    }
    return openFileLocked()
}

func openFileLocked() error {
    if activeWriter != nil {
        activeWriter.Flush()
        activeFile.Close()
    }
    path := filepath.Join(baseDir, fileName)
    f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
    if err != nil {
        return err
    }
    activeFile = f
    activeWriter = bufio.NewWriter(f)
    return nil
}

func rotateIfNeededLocked() error {
    today := time.Now().Format("20060102")
    if today == currentDate {
        return nil
    }
    // Simple rotation: rename existing file with date suffix
    oldPath := filepath.Join(baseDir, fileName)
    newPath := filepath.Join(baseDir, "activity-"+currentDate+".log")
    _ = activeWriter.Flush()
    _ = activeFile.Close()
    _ = os.Rename(oldPath, newPath)
    currentDate = today
    return openFileLocked()
}

func AppendActivity(rec ActivityRecord) error {
    mu.Lock()
    defer mu.Unlock()
    if activeWriter == nil {
        return errors.New("activity logger not initialized")
    }
    if err := rotateIfNeededLocked(); err != nil {
        return err
    }
    if rec.TS == "" {
        rec.TS = time.Now().UTC().Format(time.RFC3339)
    }
    b, _ := json.Marshal(rec)
    if _, err := activeWriter.Write(append(b, '\n')); err != nil {
        return err
    }
    return activeWriter.Flush()
}

// ReadRecent reads last N lines (approx by scanning file backwards simplistically).
func ReadRecent(limit int) ([]ActivityRecord, error) {
    path := filepath.Join(baseDir, fileName)
    f, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer f.Close()

    // Simple forward scan (OK for moderate size); optimize later with reverse seek.
    scanner := bufio.NewScanner(f)
    records := []ActivityRecord{}
    for scanner.Scan() {
        var r ActivityRecord
        if err := json.Unmarshal(scanner.Bytes(), &r); err == nil {
            records = append(records, r)
        }
    }
    if err := scanner.Err(); err != nil {
        return nil, err
    }
    if limit > 0 && len(records) > limit {
        records = records[len(records)-limit:]
    }
    // Reverse to newest-first
    for i, j := 0, len(records)-1; i < j; i, j = i+1, j-1 {
        records[i], records[j] = records[j], records[i]
    }
    return records, nil
}

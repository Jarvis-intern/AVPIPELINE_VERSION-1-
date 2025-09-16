package handlers

import (
    "sync"
    "time"
    "log"

    "github.com/shirou/gopsutil/v3/cpu"
    "github.com/shirou/gopsutil/v3/mem"
    "github.com/shirou/gopsutil/v3/disk"

    "gitlab.com/magnetite1/av-pipeline/server/sockets"
)

// SystemStatusPayload mirrors what the frontend expects.
type SystemStatusPayload struct {
    CPU     int    `json:"cpu"`
    Memory  int    `json:"memory"`
    Disk    int    `json:"disk"`
    Service string `json:"service"`
    Time    string `json:"time"`
}

// ScanStatsPayload maps to dashboard "Security Status" cards.
type ScanStatsPayload struct {
    TotalFiles   int `json:"total_files"`
    Scanned      int `json:"scanned"`
    Infected     int `json:"infected"`
    InProgress   int `json:"in_progress"`
    Time         string `json:"time"`
}

// ConversionStatsPayload maps to "File Conversion" cards.
type ConversionStatsPayload struct {
    EML   int `json:"eml"`
    MSG   int `json:"msg"`
    PST   int `json:"pst"`
    WORD  int `json:"word"`
    Time  string `json:"time"`
}

// ActivityItem a single recent activity entry.
type ActivityItem struct {
    Type string `json:"type"` // scan | conversion | workflow
    Title string `json:"title"`
    Desc  string `json:"desc"`
    Time  string `json:"time"`
}

type dashboardHub struct {
    mu        sync.RWMutex
    activities []ActivityItem
    maxActivity int
}

var dashHub = &dashboardHub{
    maxActivity: 25,
}

// appendActivity stores and broadcasts a new activity line.
func (d *dashboardHub) appendActivity(item ActivityItem) {
    d.mu.Lock()
    d.activities = append([]ActivityItem{item}, d.activities...)
    if len(d.activities) > d.maxActivity {
        d.activities = d.activities[:d.maxActivity]
    }
    activitiesCopy := append([]ActivityItem(nil), d.activities...)
    d.mu.Unlock()
    sockets.Broadcast("dashboard_recent_activity", map[string]any{
        "items": activitiesCopy,
        "time": time.Now().Format(time.RFC3339),
    })
}

// StartSystemMetricsStreamer launches a periodic push of system metrics.
func StartSystemMetricsStreamer() {
    go func() {
        ticker := time.NewTicker(5 * time.Second)
        defer ticker.Stop()
        for range ticker.C {
            status := collectSystemStatus()
            sockets.Broadcast("dashboard_system_status", status)
        }
    }()
}

// collectSystemStatus reuses (or replicates) logic behind /api/system-info/system-usage.
// Replace stubs with actual aggregation code you already have.
func collectSystemStatus() SystemStatusPayload {
    cpuPercent := 0
    memPercent := 0
    diskPercent := 0

    if cpuVals, err := cpu.Percent(0, false); err == nil && len(cpuVals) > 0 {
        cpuPercent = int(cpuVals[0] + 0.5)
    } else if err != nil {
        log.Printf("collectSystemStatus: cpu error: %v", err)
    }

    if vm, err := mem.VirtualMemory(); err == nil && vm.Total > 0 {
        memPercent = int(vm.Used * 100 / vm.Total)
    } else if err != nil {
        log.Printf("collectSystemStatus: mem error: %v", err)
    }

    if parts, err := disk.Partitions(false); err == nil {
        var used uint64
        var total uint64
        for _, p := range parts {
            if usage, err := disk.Usage(p.Mountpoint); err == nil && usage.Total > 0 {
                total += usage.Total
                used += usage.Used
            }
        }
        if total > 0 {
            diskPercent = int(used * 100 / total)
        }
    } else if err != nil {
        log.Printf("collectSystemStatus: disk error: %v", err)
    }

    return SystemStatusPayload{
        CPU: cpuPercent,
        Memory: memPercent,
        Disk: diskPercent,
        Service: "Running",
        Time: time.Now().Format(time.RFC3339),
    }
}

// EmitScanStats can be called after scan progress or completion updates.
func EmitScanStats(total, scanned, infected, inProgress int) {
    sockets.Broadcast("dashboard_scan_stats", ScanStatsPayload{
        TotalFiles: total,
        Scanned: scanned,
        Infected: infected,
        InProgress: inProgress,
        Time: time.Now().Format(time.RFC3339),
    })
}

// EmitConversionStats emits current aggregate conversion counts.
func EmitConversionStats(eml, msg, pst, word int) {
    sockets.Broadcast("dashboard_conversion_stats", ConversionStatsPayload{
        EML: eml, MSG: msg, PST: pst, WORD: word,
        Time: time.Now().Format(time.RFC3339),
    })
}

// Public helper to append an activity.
func EmitActivity(item ActivityItem) {
    dashHub.appendActivity(item)
}
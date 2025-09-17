package handlers

import (
    "bufio"
    "encoding/json"
    "net/http"
    "os"
    "path/filepath"
    "sort"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
    "gitlab.com/magnetite1/av-pipeline/server/logger"
)

type opRecord map[string]any

func RegisterOperationLogRoutes(r *gin.Engine) {
    r.GET("/api/operation-logs", getOperationLogs)
    r.GET("/api/operation-logs/stats", getOperationLogStats)
    r.POST("/api/operation-logs/debug", postOperationLogDebug)
    r.GET("/api/operation-logs/debug", getOperationLogDebug)
}

func getOperationLogs(c *gin.Context) {
    limitStr := c.Query("limit")
    limit := 200
    if limitStr != "" {
        if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
            limit = v
        }
    }
    typeFilter := c.Query("type")
    taskFilter := c.Query("task_id")

    // Only read today's file for now (extend later if needed).
    today := time.Now().Format("20060102")
    path := filepath.Join("logs", "operations-"+today+".jsonl")
    f, err := os.Open(path)
    if err != nil {
        c.JSON(http.StatusOK, gin.H{"items": []opRecord{}})
        return
    }
    defer f.Close()

    scanner := bufio.NewScanner(f)
    all := []opRecord{}
    for scanner.Scan() {
        line := strings.TrimSpace(scanner.Text())
        if line == "" {
            continue
        }
        var rec opRecord
        if err := json.Unmarshal([]byte(line), &rec); err == nil {
            if typeFilter != "" && rec["kind"] != typeFilter {
                continue
            }
            if taskFilter != "" && rec["task_id"] != taskFilter {
                continue
            }
            all = append(all, rec)
        }
    }
    // newest first
    sort.Slice(all, func(i, j int) bool {
        return all[i]["ts"].(string) > all[j]["ts"].(string)
    })
    if len(all) > limit {
        all = all[:limit]
    }
    c.JSON(http.StatusOK, gin.H{"items": all})
}

// getOperationLogStats aggregates counts for today
func getOperationLogStats(c *gin.Context) {
    today := time.Now().Format("20060102")
    path := filepath.Join("logs", "operations-"+today+".jsonl")
    f, err := os.Open(path)
    if err != nil {
        c.JSON(http.StatusOK, gin.H{"counts": map[string]int{}, "latest": nil})
        return
    }
    defer f.Close()
    counts := map[string]int{}
    latest := map[string]string{}
    scanner := bufio.NewScanner(f)
    for scanner.Scan() {
        line := strings.TrimSpace(scanner.Text())
        if line == "" { continue }
        var rec opRecord
        if err := json.Unmarshal([]byte(line), &rec); err == nil {
            kind, _ := rec["kind"].(string)
            ts, _ := rec["ts"].(string)
            if kind != "" {
                counts[kind]++
                if prev, ok := latest[kind]; !ok || ts > prev {
                    latest[kind] = ts
                }
            }
        }
    }
    c.JSON(http.StatusOK, gin.H{"counts": counts, "latest": latest})
}

// postOperationLogDebug writes a sample record (useful for validating front-end rendering)
func postOperationLogDebug(c *gin.Context) {
    logger.LogConversion("debug_task", "/tmp/sample.eml", ".eml", ".html", "success", "eml")
    c.JSON(http.StatusOK, gin.H{"status": "written"})
}

func getOperationLogDebug(c *gin.Context) {
    logger.LogConversion("debug_task_get", "/tmp/sample2.eml", ".eml", ".html", "success", "eml")
    c.JSON(http.StatusOK, gin.H{"status": "written"})
}
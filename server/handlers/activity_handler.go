package handlers

import (
    "net/http"
    "strconv"
    "time"

    "github.com/gin-gonic/gin"
    "gitlab.com/magnetite1/av-pipeline/server/logger"
)

func RegisterActivityRoutes(r *gin.Engine) {
    api := r.Group("/api/activity")
    api.GET("/recent", getRecentActivity)
    api.GET("/stats", getActivityStats)
}

func getRecentActivity(c *gin.Context) {
    limitStr := c.Query("limit")
    limit := 100
    if limitStr != "" {
        if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
            limit = v
        }
    }
    records, err := logger.ReadRecent(limit)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read activity"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"items": records})
}

func getActivityStats(c *gin.Context) {
    records, err := logger.ReadRecent(1000)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read activity"})
        return
    }
    typeCounts := map[string]int{}
    today := time.Now().UTC().Format("2006-01-02")
    todayCounts := map[string]int{}
    for _, r := range records {
        typeCounts[r.Type]++
        if len(r.TS) >= 10 && r.TS[:10] == today {
            todayCounts[r.Type]++
        }
    }
    c.JSON(http.StatusOK, gin.H{
        "counts":       typeCounts,
        "today_counts": todayCounts,
    })
}
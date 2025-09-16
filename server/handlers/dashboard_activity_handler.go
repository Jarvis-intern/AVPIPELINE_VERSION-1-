package handlers

import (
    "net/http"
    "strconv"
    "github.com/gin-gonic/gin"
    "gitlab.com/magnetite1/av-pipeline/server/logger"
)

// GetDashboardActivity returns aggregate counts and recent activity records for dashboard initialization.
func GetDashboardActivity(c *gin.Context) {
    limit := 50
    if l := c.Query("limit"); l != "" {
        if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
            limit = n
        }
    }
    recs, err := logger.ReadRecent(limit)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    counts := map[string]int{
        "scan_files":      0,
        "scan_infected":   0,
        "converted_files": 0,
        "conversion_fail": 0,
    }
    for _, r := range recs { // recs newest-first already limited
        switch r.Type {
        case "scan_file":
            counts["scan_files"]++
            if r.Status == "infected" {
                counts["scan_infected"]++
            }
        case "conversion_file":
            if r.Status == "converted" { counts["converted_files"]++ }
            if r.Status == "failed" { counts["conversion_fail"]++ }
        }
    }
    c.JSON(http.StatusOK, gin.H{"counts": counts, "recent": recs})
}

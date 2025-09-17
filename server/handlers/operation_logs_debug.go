package handlers

import (
    "os"
    "path/filepath"
    "time"
    "bufio"
    "encoding/json"
    "github.com/gin-gonic/gin"
)

func RegisterOperationDebug(r *gin.Engine) {
    r.GET("/api/operation-logs/debug-file", func(c *gin.Context) {
        name := filepath.Join("logs", "operations-"+time.Now().Format("20060102")+".jsonl")
        info, err := os.Stat(name)
        if err != nil {
            c.JSON(200, gin.H{"exists": false, "error": err.Error()})
            return
        }
        f, _ := os.Open(name)
        defer f.Close()
        sc := bufio.NewScanner(f)
        lines := 0
        var last map[string]any
        for sc.Scan() {
            lines++
            json.Unmarshal(sc.Bytes(), &last)
        }
        c.JSON(200, gin.H{"exists": true, "size": info.Size(), "lines": lines, "last": last})
    })
}
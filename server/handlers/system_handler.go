package handlers

import (
	"fmt"
	"runtime"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

func GetIPAddress(c *gin.Context) {
	fmt.Println(c.RemoteIP())
	c.JSON(200, gin.H{"ip_address": c.RemoteIP()})
}

func GetSystemUsage(c *gin.Context) {
	// CPU usage
	cpuPercent, err := cpu.Percent(time.Second, false)
	if err != nil || len(cpuPercent) == 0 {
		c.JSON(500, gin.H{"error": "Failed to get CPU usage"})
		return
	}
	cpuCores, _ := cpu.Counts(false)
	cpuThreads, _ := cpu.Counts(true)

	// Memory
	memStats, err := mem.VirtualMemory()
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get memory info"})
		return
	}
	totalMemGB := float64(memStats.Total) / (1024 * 1024 * 1024)
	usedMemGB := float64(memStats.Used) / (1024 * 1024 * 1024)

	// Disk
	diskStats, err := disk.Usage("/")
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to get disk info"})
		return
	}
	totalDiskGB := float64(diskStats.Total) / (1024 * 1024 * 1024)
	usedDiskGB := float64(diskStats.Used) / (1024 * 1024 * 1024)

	// Platform info
	system := runtime.GOOS
	release := "unknown" // can use `os-release` file or `uname -r` with `os/exec` for more detail

	c.JSON(200, gin.H{
		"cpu": gin.H{
			"cpu_usage":         cpuPercent[0],
			"total_cpu_percent": 100,
			"cpu_cores":         cpuCores,
			"cpu_threads":       cpuThreads,
		},
		"memory": gin.H{
			"total_memory": totalMemGB,
			"used_memory":  usedMemGB,
		},
		"disk": gin.H{
			"total_disk": totalDiskGB,
			"used_disk":  usedDiskGB,
		},
		"platform": gin.H{
			"system":  system,
			"release": release,
		},
	})
}

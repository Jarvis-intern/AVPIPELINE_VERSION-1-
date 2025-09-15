package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"context"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/proto"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func GetAVs(c *gin.Context) {
	var av models.AV
	avs, err := av.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve AVs"})
		return
	}
	c.JSON(http.StatusOK, avs)
}

func GetAVByID(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var av models.AV
	if err := av.GetByID(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "AV not found"})
		return
	}
	c.JSON(http.StatusOK, av)
}

func CreateAV(c *gin.Context) {
	var av models.AV
	if err := c.ShouldBindJSON(&av); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}
	if err := av.Create(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create AV"})
		return
	}
	c.JSON(http.StatusCreated, av)
}

func UpdateAV(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var existingAV models.AV
	if err := existingAV.GetByID(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "AV not found"})
		return
	}

	if err := c.ShouldBindJSON(&existingAV); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON"})
		return
	}

	if err := existingAV.Update(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update AV"})
		return
	}
	c.JSON(http.StatusOK, existingAV)
}

func DeleteAV(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var av models.AV
	if err := av.GetByID(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "AV not found"})
		return
	}

	if err := av.Delete(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete AV"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "AV deleted"})
}

// GRPC Implementation
func HandleScanning(client *sockets.Client, data map[string]any) {
	if scanningId, ok := data["scanning_id"].(string); ok && scanningId != "" {
		go handleAdhocScanning(client, data)
	} else if taskID, ok := data["task_id"].(string); ok && taskID != "" {
		go handleAutomationScanning(client, data)
	} else {
		sockets.EmitError(client, "Missing required ID (scanningId or task_id)", "scanning_error")
	}
}

func handleAdhocScanning(client *sockets.Client, data map[string]any) {
	scanningID, _ := data["scanning_id"].(string)
	scanPath, _ := data["scan_path"].(string)
	// systemIp, _ := data["system_ip"].(string)
	avIdFloat, ok := data["av_id"].(float64)
	if !ok {
		sockets.EmitError(client, "Invalid av_id", "av_scan_error")
		return
	}
	avId := uint(avIdFloat)

	var avData models.AV
	if err := avData.GetByID(avId); err != nil {
		sockets.EmitError(client, "Failed to get AV data: "+err.Error(), "av_scan_error")
		return
	}
	fmt.Println("AV DAta", avData)
	conn, err := grpc.NewClient(fmt.Sprintf("%s:50051", avData.IPAddress), grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		sockets.EmitError(client, "Failed to connect to AV gRPC server: "+err.Error(), "av_scan_error")
		return
	}

	defer conn.Close()

	avClient := proto.NewAVScannerClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	req := &proto.ScanRequest{
		ScanId:     scanningID,
		ScanPath:   scanPath,
		AvToolName: avData.Name,
		Command:    avData.ScanCommand,
	}

	stream, err := avClient.StartScan(ctx, req)
	if err != nil {
		sockets.EmitError(client, "Failed to start AV scan: "+err.Error(), "av_scan_error")
		return
	}

	for {
		logEntry, err := stream.Recv()
		if err != nil {
			if err.Error() != "EOF" {
				sockets.EmitError(client, "Error receiving AV scan log: "+err.Error(), "av_scan_error")
			}
			break
		}
		// Convert proto.ScanLog to map[string]any for frontend
		logMap := map[string]any{
			"scan_id":   logEntry.GetScanId(),
			"content":   logEntry.GetContent(),
			"timestamp": logEntry.GetTimestamp(),
			"level":     logEntry.GetLevel(),
			"file_path": logEntry.GetFilePath(),
			"progress":  logEntry.GetProgress(),
		}
		// Emit log to frontend
		sockets.EmitToUser(client.UserID, "av_scan_log", logMap)
		// Store log in DB
		SaveAVScanLogToDB(logEntry)
	}

	sockets.EmitToUser(client.UserID, "av_scan_complete", map[string]any{
		"scanning_id": scanningID,
		"message":     "AV scan complete",
		"end_time":    time.Now().Format(time.RFC3339),
	})
}

// SaveAVScanLogToDB saves a scan log entry to the database
func SaveAVScanLogToDB(log *proto.ScanLog) {
	// You may want to add AVName as a parameter if you want to link logs to a specific AV
	entry := models.AVScanLog{
		TaskID:    log.GetScanId(), // This assumes scan_id is the task_id; adjust if needed
		ScanID:    log.GetScanId(),
		Content:   log.GetContent(),
		Timestamp: log.GetTimestamp(),
		Level:     int(log.GetLevel()),
		FilePath:  log.GetFilePath(),
		Progress:  int(log.GetProgress()),
	}
	_ = entry.Create()
}

func handleAutomationScanning(client *sockets.Client, data map[string]any) {
	taskId, _ := data["task_id"].(string)
	scanPath, _ := data["scan_path"].(string)
	avNames, ok := data["av_names"].([]interface{})
	if !ok || len(avNames) == 0 {
		sockets.EmitError(client, "Missing or invalid av_ids", "av_scan_error")
		return
	}

	// 1. Initialize avScanData in progress if not already present
	// Fetch current progress array
	taskProgress, err := models.GetTaskProgress(config.DB, taskId)
	var progressArr []map[string]interface{}
	if err == nil && taskProgress != nil && taskProgress.ID != 0 && taskProgress.Progress != "" {
		_ = json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
	}
	// Find or create AV_SCAN stage
	avScanStageIdx := -1
	for i, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == "AV_SCAN" {
			avScanStageIdx = i
			break
		}
	}
	if avScanStageIdx == -1 {
		// Not found, create
		avScanData := []map[string]interface{}{}
		for _, avNameRaw := range avNames {
			avName, _ := avNameRaw.(string)
			avScanData = append(avScanData, map[string]interface{}{
				"avName":  avName,
				"rawLogs": "",
				"status":  "PENDING",
			})
		}
		progressArr = append(progressArr, map[string]interface{}{
			"type":       "AV_SCAN",
			"status":     "RUNNING",
			"progress":   0,
			"avScanData": avScanData,
		})
		progressJSON, _ := json.Marshal(progressArr)
		_ = models.UpdateTaskProgress(config.DB, taskId, string(progressJSON))
		emitWorkflowProgress(client.UserID, taskId)
	}

	var wg sync.WaitGroup
	for _, avNameRaw := range avNames {
		avName, _ := avNameRaw.(string)

		wg.Add(1)
		go func(avName string) {
			defer wg.Done()
			var avData models.AV
			if err := avData.GetByName(avName); err != nil {
				sockets.EmitError(client, "Failed to get AV data: "+err.Error(), "av_scan_error")
				return
			}

			// --- LOG BUFFERING SETUP ---
			logBuffer := make([]*proto.ScanLog, 0, 20)
			var logBufferMutex sync.Mutex
			flushLogs := func() {
				logBufferMutex.Lock()
				defer logBufferMutex.Unlock()
				if len(logBuffer) == 0 {
					return
				}
				// Convert to AVScanLog entries
				entries := make([]models.AVScanLog, 0, len(logBuffer))
				for _, log := range logBuffer {
					entries = append(entries, models.AVScanLog{
						TaskID:    taskId,
						AVName:    avData.Name,
						ScanID:    log.GetScanId(),
						Content:   log.GetContent(),
						Timestamp: log.GetTimestamp(),
						Level:     int(log.GetLevel()),
						FilePath:  log.GetFilePath(),
						Progress:  int(log.GetProgress()),
					})
				}
				if len(entries) == 1 {
					_ = entries[0].Create()
				} else if len(entries) > 1 {
					_ = models.BatchCreateAVScanLogs(entries)
				}
				logBuffer = logBuffer[:0]
			}
			// Periodic flusher
			stopFlusher := make(chan struct{})
			go func() {
				ticker := time.NewTicker(4 * time.Second)
				defer ticker.Stop()
				for {
					select {
					case <-ticker.C:
						flushLogs()
					case <-stopFlusher:
						flushLogs()
						return
					}
				}
			}()
			// --- END LOG BUFFERING SETUP ---

			// Update avScanData: set status RUNNING for this AV and set startTime
			scanStartTime := time.Now().Format(time.RFC3339)
			taskProgress, _ := models.GetTaskProgress(config.DB, taskId)
			var progressArr []map[string]interface{}
			_ = json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
			for i, stage := range progressArr {
				if t, ok := stage["type"].(string); ok && t == "AV_SCAN" {
					if avScanData, ok := stage["avScanData"].([]interface{}); ok {
						for j, avEntryRaw := range avScanData {
							avEntry, _ := avEntryRaw.(map[string]interface{})
							if avEntry["avName"] == avData.Name {
								avEntry["status"] = "RUNNING"
								avEntry["startTime"] = scanStartTime
								avScanData[j] = avEntry
								break
							}
						}
						stage["avScanData"] = avScanData
						progressArr[i] = stage
					}
				}
			}
			progressJSON, _ := json.Marshal(progressArr)
			_ = models.UpdateTaskProgress(config.DB, taskId, string(progressJSON))
			emitWorkflowProgress(client.UserID, taskId)

			address := fmt.Sprintf("%s:50051", avData.IPAddress)
			conn, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
			if err != nil {
				sockets.EmitError(client, "Failed to connect to AV gRPC server: "+err.Error(), "av_scan_error")
				close(stopFlusher)
				return
			}
			defer conn.Close()

			avClient := proto.NewAVScannerClient(conn)
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
			defer cancel()

			req := &proto.ScanRequest{
				ScanId:     taskId,
				ScanPath:   scanPath,
				AvToolName: avData.Name,
				Command:    avData.ScanCommand,
			}

			stream, err := avClient.StartScan(ctx, req)
			if err != nil {
				sockets.EmitError(client, "Failed to start AV scan: "+err.Error(), "av_scan_error")
				close(stopFlusher)
				return
			}

			for {
				logEntry, err := stream.Recv()
				if err != nil {
					if err.Error() != "EOF" {
						sockets.EmitError(client, "Error receiving AV scan log: "+err.Error(), "av_scan_error")
					}
					break
				}
				logMap := map[string]any{
					"av_id":     avData.ID,
					"av_name":   avData.Name,
					"scan_id":   logEntry.GetScanId(),
					"content":   logEntry.GetContent(),
					"timestamp": logEntry.GetTimestamp(),
					"level":     logEntry.GetLevel(),
					"file_path": logEntry.GetFilePath(),
					"progress":  logEntry.GetProgress(),
				}
				sockets.EmitToUser(client.UserID, "av_scan_log", logMap)
				// Buffer log for interval DB save
				logBufferMutex.Lock()
				logBuffer = append(logBuffer, logEntry)
				logBufferMutex.Unlock()

				// Append log object to scanLogs array
				taskProgress, _ := models.GetTaskProgress(config.DB, taskId)
				var progressArr []map[string]interface{}
				_ = json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
				for i, stage := range progressArr {
					if t, ok := stage["type"].(string); ok && t == "AV_SCAN" {
						if avScanData, ok := stage["avScanData"].([]interface{}); ok {
							for j, avEntryRaw := range avScanData {
								avEntry, _ := avEntryRaw.(map[string]interface{})
								if avEntry["avName"] == avData.Name {
									// Append log object to scanLogs array
									logObj := map[string]interface{}{
										"scan_id":   logEntry.GetScanId(),
										"content":   logEntry.GetContent(),
										"timestamp": logEntry.GetTimestamp(),
										"level":     logEntry.GetLevel(),
										"file_path": logEntry.GetFilePath(),
										"progress":  logEntry.GetProgress(),
									}
									scanLogs, _ := avEntry["scanLogs"].([]interface{})
									scanLogs = append(scanLogs, logObj)
									avEntry["scanLogs"] = scanLogs
									avScanData[j] = avEntry
									break
								}
							}
							stage["avScanData"] = avScanData
							progressArr[i] = stage
						}
					}
				}
				progressJSON, _ := json.Marshal(progressArr)
				_ = models.UpdateTaskProgress(config.DB, taskId, string(progressJSON))
				// Optionally emit progress here if you want real-time updates
			}

			// Update avScanData: set status DONE for this AV, set endTime, emit av_scan_done event
			scanEndTime := time.Now().Format(time.RFC3339)
			taskProgress, _ = models.GetTaskProgress(config.DB, taskId)
			_ = json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
			updated := false
			for i, stage := range progressArr {
				if t, ok := stage["type"].(string); ok && t == "AV_SCAN" {
					if avScanData, ok := stage["avScanData"].([]interface{}); ok {
						for j, avEntryRaw := range avScanData {
							avEntry, ok := avEntryRaw.(map[string]interface{})
							if !ok {
								fmt.Printf("[WARN] Could not assert avEntryRaw to map[string]interface{} for AV %v\n", avData.Name)
								continue
							}
							if avEntry["avName"] == avData.Name {
								avEntry["status"] = "DONE"
								avEntry["endTime"] = scanEndTime
								// Emit per-AV scan done event
								doneEvent := map[string]interface{}{
									"avName":    avData.Name,
									"status":    "DONE",
									"startTime": avEntry["startTime"],
									"endTime":   scanEndTime,
								}
								sockets.EmitToUser(client.UserID, "av_scan_done", doneEvent)
								avScanData[j] = avEntry
								updated = true
								break
							}
						}
						stage["avScanData"] = avScanData
						progressArr[i] = stage
					}
				}
			}
			if updated {
				progressJSON, _ = json.Marshal(progressArr)
				_ = models.UpdateTaskProgress(config.DB, taskId, string(progressJSON))
				emitWorkflowProgress(client.UserID, taskId)
			} else {
				fmt.Printf("[ERROR] Failed to update AV status to DONE for AV %v in task %v\n", avData.Name, taskId)
			}

			// --- FLUSH REMAINING LOGS ---
			close(stopFlusher)
		}(avName)
	}

	// Wait for all scans to complete, then emit a final event
	go func() {
		wg.Wait()
		// After all AVs are done, update AV_SCAN stage to DONE and set endTime
		taskProgress, _ := models.GetTaskProgress(config.DB, taskId)
		var progressArr []map[string]interface{}
		_ = json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
		for i, stage := range progressArr {
			if t, ok := stage["type"].(string); ok && t == "AV_SCAN" {
				stage["status"] = "DONE"
				stage["endTime"] = time.Now().Format(time.RFC3339)
				progressArr[i] = stage
			}
		}
		progressJSON, _ := json.Marshal(progressArr)
		_ = models.UpdateTaskProgress(config.DB, taskId, string(progressJSON))
		sockets.EmitToUser(client.UserID, "av_scan_complete", map[string]any{
			"scanning_id": taskId,
			"message":     "All AV scans complete",
			"end_time":    time.Now().Format(time.RFC3339),
		})
		SignalStageComplete(taskId, "AV_SCAN")
	}()
}

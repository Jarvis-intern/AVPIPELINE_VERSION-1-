package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
	"gorm.io/gorm"
	"gitlab.com/magnetite1/av-pipeline/server/logger"
)

// Global map to track stage completion channels
var stageDoneChans = make(map[string]chan struct{})
var stageDoneFlags = make(map[string]bool) // to handle early/late signals
var stageMu sync.Mutex

const stageWaitTimeout = 30 * time.Minute

func emitWorkflowProgress(userID, taskID string) {
	var taskProgress models.TaskProgress
	err := config.DB.Where("task_id = ?", taskID).First(&taskProgress).Error
	var progressArr []interface{}
	if err == nil {
		err2 := json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
		if err2 != nil {
			progressArr = nil
		}
	}
	sockets.EmitToUser(userID, "workflow_progress", map[string]any{
		"task_id":  taskID,
		"progress": progressArr,
		"time":     time.Now().Format(time.RFC3339),
	})
}

func Start_automation(client *sockets.Client, data map[string]any) {
	stageProgress, ok := data["stageProgress"].([]interface{})
	if !ok {
		sockets.EmitError(client, "stage data not found or invalid", "automation_error")
		return
	}
	taskID, ok := data["task_id"].(string)
	if !ok || taskID == "" {
		sockets.EmitError(client, "task_id not found or invalid", "automation_error")
		return
	}
	rawFilePath, _ := data["filePath"].(string)
	rawAvFilePath, _ := data["avFilePath"].(string)

	// Normalize and validate the main filePath (must exist on this VM)
	filePath, errNorm := normalizeInputPath(rawFilePath)
	if errNorm != nil {
		sockets.EmitError(client, fmt.Sprintf("invalid filePath: %v", errNorm), "automation_error")
		return
	}

	// Preserve AV file path separately. We TRY to normalize (in case it's also local),
	// but if that fails we keep the raw user-provided path instead of falling back
	// to filePath (old behavior caused merging/confusion).
	avFilePath := filePath // default if user leaves it blank
	if strings.TrimSpace(rawAvFilePath) != "" {
		if p2, err2 := normalizeInputPath(rawAvFilePath); err2 == nil {
			avFilePath = p2
		} else {
			// Accept raw path (likely remote share path) without forcing existence here.
			avFilePath = rawAvFilePath
			sockets.EmitToUser(client.UserID, "automation_info", map[string]any{
				"task_id":     taskID,
				"message":     "AV File Path kept as raw (not found locally): " + rawAvFilePath,
				"avFilePath":  avFilePath,
				"filePath":    filePath,
				"note":        "This is expected if AV path is on remote AV VMs.",
			})
		}
	}

	progressBytes, err := json.Marshal(stageProgress)
	if err != nil {
		sockets.EmitError(client, "failed to serialize progress data", "automation_error")
		return
	}

	// Fetch task to obtain SystemIP (required for TaskProgress)
	var task models.Task
	if err := config.DB.Where("unique_id = ?", taskID).First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			sockets.EmitError(client, "task not found for progress init", "automation_error")
			return
		}
		sockets.EmitError(client, "failed to load task for progress: "+err.Error(), "automation_error")
		return
	}

	var taskProgress models.TaskProgress
	err = config.DB.Where("task_id = ?", taskID).First(&taskProgress).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		sockets.EmitError(client, "database error: "+err.Error(), "automation_error")
		return
	}

	taskProgress.TaskID = taskID
	taskProgress.SystemIP = task.SystemIP // ensure NOT NULL field populated
	taskProgress.Progress = string(progressBytes)

	if err == gorm.ErrRecordNotFound {
		if err := config.DB.Create(&taskProgress).Error; err != nil {
			sockets.EmitError(client, "failed to create progress: "+err.Error(), "automation_error")
			return
		}
	} else {
		if err := config.DB.Save(&taskProgress).Error; err != nil {
			sockets.EmitError(client, "failed to update progress: "+err.Error(), "automation_error")
			return
		}
	}

	sockets.EmitToUser(client.UserID, "automation_progress_initialized", map[string]any{
		"task_id":    taskID,
		"progress":   stageProgress,
		"filePath":   filePath,
		"avFilePath": avFilePath,
	})

	StartWorkflowOrchestration(client, taskID, client.UserID, stageProgress, filePath, avFilePath)
}

// normalizeInputPath resolves common user-provided paths to actual filesystem paths.
// It expands ~, handles "/Downloads/..." or "Downloads/..." by prefixing the user's home,
// and verifies the path exists. Returns an absolute path.
func normalizeInputPath(p string) (string, error) {
	p = strings.TrimSpace(p)
	if p == "" {
		return "", fmt.Errorf("empty path")
	}
	// Expand ~
	if strings.HasPrefix(p, "~") {
		if home, err := os.UserHomeDir(); err == nil {
			p = filepath.Join(home, strings.TrimPrefix(p, "~/"))
		}
	}
	candidates := []string{}
	// Absolute as-is
	if filepath.IsAbs(p) {
		candidates = append(candidates, p)
		// Handle common mistake: "/Downloads/..." instead of "$HOME/Downloads/..."
		if strings.HasPrefix(p, "/Downloads/") {
			if home, err := os.UserHomeDir(); err == nil {
				candidates = append(candidates, filepath.Join(home, p[1:]))
			}
		}
	} else {
		// Relative: try cwd, then $HOME/Downloads/<p>
		if abs, err := filepath.Abs(p); err == nil {
			candidates = append(candidates, abs)
		}
		if home, err := os.UserHomeDir(); err == nil {
			if strings.HasPrefix(p, "Downloads/") || strings.HasPrefix(p, "./Downloads/") {
				candidates = append(candidates, filepath.Join(home, strings.TrimPrefix(strings.TrimPrefix(p, "./"), "/")))
			}
			candidates = append(candidates, filepath.Join(home, "Downloads", p))
		}
	}
	// Deduplicate candidates while checking
	seen := map[string]struct{}{}
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, ok := seen[c]; ok {
			continue
		}
		seen[c] = struct{}{}
		if _, err := os.Stat(c); err == nil {
			// Return the actual absolute path
			if !filepath.IsAbs(c) {
				if abs, err2 := filepath.Abs(c); err2 == nil {
					return abs, nil
				}
			}
			return c, nil
		}
	}
	return "", fmt.Errorf("path not found: %s", p)
}

// isArchivePath returns true if the path looks like a supported archive.
func isArchivePath(p string) bool {
	name := strings.ToLower(filepath.Base(p))
	return strings.HasSuffix(name, ".zip") ||
		strings.HasSuffix(name, ".rar") ||
		strings.HasSuffix(name, ".7z") ||
		strings.HasSuffix(name, ".tar") ||
		strings.HasSuffix(name, ".tar.gz") ||
		strings.HasSuffix(name, ".tgz") ||
		strings.HasSuffix(name, ".tar.bz2") ||
		strings.HasSuffix(name, ".tar.xz") ||
		strings.HasSuffix(name, ".txz") ||
		strings.HasSuffix(name, ".gz") ||
		strings.HasSuffix(name, ".ace") ||
		strings.HasSuffix(name, ".arj") ||
		strings.HasSuffix(name, ".lzh") ||
		strings.HasSuffix(name, ".z") ||
		strings.HasSuffix(name, ".r00") ||
		strings.HasSuffix(name, ".arc")
}

// extractedDirFor guesses the extraction directory used by extract_handler for a given archive path.
func extractedDirFor(archivePath string) (string, bool) {
	base := filepath.Base(archivePath)
	// Handle compound extensions first
	name := base
	lower := strings.ToLower(base)
	switch {
	case strings.HasSuffix(lower, ".tar.gz"):
		name = strings.TrimSuffix(base, ".tar.gz")
	case strings.HasSuffix(lower, ".tar.xz"):
		name = strings.TrimSuffix(base, ".tar.xz")
	case strings.HasSuffix(lower, ".tar.bz2"):
		name = strings.TrimSuffix(base, ".tar.bz2")
	default:
		name = strings.TrimSuffix(base, filepath.Ext(base))
	}
	dir := filepath.Join(filepath.Dir(archivePath), name+"_extracted")
	return dir, true
}

func StartWorkflowOrchestration(client *sockets.Client, taskID string, userID string, stageProgress []interface{}, filePath string, avFilePath string) {
	go func() {
		// Track working directory for subsequent stages
		workPath := filePath
		for i, stage := range stageProgress {
			stageMap, ok := stage.(map[string]interface{})
			if !ok {
				fmt.Printf("Invalid stage format at index %d: %#v\n", i, stage)
				continue
			}
			fmt.Println("Stages", stageMap["type"])
			stageType, _ := stageMap["type"].(string)

			// Emit workflow_next_stage event before starting each stage
			var taskProgress models.TaskProgress
			err := config.DB.Where("task_id = ?", taskID).First(&taskProgress).Error
			var progressArr []interface{}
			if err == nil {
				err2 := json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
				if err2 != nil {
					progressArr = stageProgress // fallback
				}
			} else {
				progressArr = stageProgress // fallback
			}
			sockets.EmitToUser(userID, "workflow_next_stage", map[string]any{
				"task_id":    taskID,
				"next_stage": stageType,
				"progress":   progressArr,
			})

			logger.LogAutomationStage(taskID, stageType, "started", 0)

			switch stageType {
			// AFTER (The correct version for automation)

			case "EXTRACTION":
				progress := map[string]interface{}{
					"type":   "EXTRACTION",
					"status": "RUNNING",
				}
				UpdateStageProgressArray(taskID, "EXTRACTION", progress)
				emitWorkflowProgress(userID, taskID)

				// Create the extraction task. We provide an empty password map
				// because this is an automated run.
				extractionTask := ExtractionTask{
					FolderPath: filePath,
					TaskID:     taskID,
					Passwords:  make(map[string]string), // Provide an empty map
				}

				extractionService := NewExtractionService()

				// Start in discovery mode to allow UI to collect passwords, then user triggers actual extraction
				go extractionService.StartExtractionWithWebSocket(extractionTask, userID)

				// Now, wait for the signal that the extraction is truly complete.
				waitForStageCompletion(taskID, "EXTRACTION")
				fmt.Println("continue after extraction")

				// After extraction, if the input was an archive file, switch to its extracted folder
				if isArchivePath(filePath) {
					if exDir, ok := extractedDirFor(filePath); ok {
						if st, err := os.Stat(exDir); err == nil && st.IsDir() {
							workPath = exDir
						}
					}
				} else {
					// If user provided a directory, keep it as workPath
					workPath = filePath
				}
			case "CONVERSION":
				// Robustly extract types from either conversionResults or conversion
				var conversionTypes []interface{}
				if arr, ok := stageMap["conversionResults"].([]interface{}); ok && len(arr) > 0 {
					for _, c := range arr {
						if cMap, ok := c.(map[string]interface{}); ok {
							if t, ok := cMap["type"]; ok {
								conversionTypes = append(conversionTypes, t)
							}
						}
					}
				} else if arr, ok := stageMap["conversion"].([]interface{}); ok && len(arr) > 0 {
					conversionTypes = append(conversionTypes, arr...)
				}

				progress := map[string]interface{}{
					"type":              "CONVERSION",
					"status":            "RUNNING",
					"conversionResults": stageMap["conversionResults"],
				}
				UpdateStageProgressArray(taskID, "CONVERSION", progress)

				data := map[string]any{
					"conversion_list": conversionTypes,
					"path":            workPath,
					"task_id":         taskID,
				}
				go HandleStartConversion(client, data)
				waitForStageCompletion(taskID, "CONVERSION")
				fmt.Println("continue after conversion")
			case "REMOVAL":
				// Robustly extract from removalResults or removal
				var removalTypes []interface{}
				if arr, ok := stageMap["removalResults"].([]interface{}); ok && len(arr) > 0 {
					for _, r := range arr {
						if rMap, ok := r.(map[string]interface{}); ok {
							if t, ok := rMap["type"]; ok {
								removalTypes = append(removalTypes, t)
							}
						}
					}
				} else if arr, ok := stageMap["removal"].([]interface{}); ok && len(arr) > 0 {
					removalTypes = append(removalTypes, arr...)
				}

				if len(removalTypes) > 0 {
					progress := map[string]interface{}{
						"type":           "REMOVAL",
						"status":         "RUNNING",
						"removalResults": stageMap["removalResults"],
					}
					UpdateStageProgressArray(taskID, "REMOVAL", progress)
					emitWorkflowProgress(userID, taskID)
					data := map[string]any{
						"removal_list": removalTypes,
						"folder_path":  workPath,
						"task_id":      taskID,
					}
					go HandleRemoveFiles(client, data)
					waitForStageCompletion(taskID, "REMOVAL")
				}
			case "VERIFICATION":
				// Check for auto_proceed flag
				autoProceed := false
				fmt.Println("Auto Proceed", stageMap["auto_proceed"])
				if ap, ok := stageMap["auto_proceed"].(bool); ok {
					autoProceed = ap
				}
				progress := map[string]interface{}{
					"type":                 "VERIFICATION",
					"status":               "RUNNING",
					"verifyRemovalResults": stageMap["verifyRemovalResults"],
				}
				UpdateStageProgressArray(taskID, "VERIFICATION", progress)
				emitWorkflowProgress(userID, taskID)
				if autoProceed {
					// Immediately mark as DONE and proceed
					progressDone := map[string]interface{}{
						"type":     "VERIFICATION",
						"status":   "DONE",
						"progress": 100,
						"message":  "Verification auto-approved",
						"end_time": time.Now().Format(time.RFC3339),
					}
					UpdateStageProgressArray(taskID, "VERIFICATION", progressDone)
					emitWorkflowProgress(userID, taskID)
					sockets.EmitToUser(userID, "verification_complete", map[string]any{
						"task_id":  taskID,
						"message":  "Verification auto-approved",
						"end_time": time.Now().Format(time.RFC3339),
					})
				} else {
					sockets.EmitToUser(userID, "verification_complete", map[string]any{
						"task_id":  taskID,
						"message":  "Verification complete",
						"end_time": time.Now().Format(time.RFC3339),
					})
					waitForStageCompletion(taskID, "VERIFICATION")
				}
			case "VERIFY_REMOVAL":
				// Robustly extract from verifyRemovalResults or verify_removal
				var verifyRemovalTypes []interface{}
				if arr, ok := stageMap["verifyRemovalResults"].([]interface{}); ok && len(arr) > 0 {
					for _, r := range arr {
						if rMap, ok := r.(map[string]interface{}); ok {
							if t, ok := rMap["type"]; ok {
								verifyRemovalTypes = append(verifyRemovalTypes, t)
							}
						}
					}
				} else if arr, ok := stageMap["verify_removal"].([]interface{}); ok && len(arr) > 0 {
					verifyRemovalTypes = append(verifyRemovalTypes, arr...)
				}

				if len(verifyRemovalTypes) > 0 {
					progress := map[string]interface{}{
						"type":   "VERIFY_REMOVAL",
						"status": "RUNNING",
					}
					UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", progress)
					emitWorkflowProgress(userID, taskID)
					data := map[string]any{
						"verify_removal_list": verifyRemovalTypes,
						"folder_path":         workPath,
						"task_id":             taskID,
					}
					go HandleVerifyRemoveFiles(client, data)
					waitForStageCompletion(taskID, "VERIFY_REMOVAL")
				}
			case "AV_SCAN":
				// Robustly extract from avScanData or avs
				var avNames []interface{}
				if arr, ok := stageMap["avScanData"].([]interface{}); ok && len(arr) > 0 {
					for _, a := range arr {
						if aMap, ok := a.(map[string]interface{}); ok {
							if id, ok := aMap["avName"]; ok {
								avNames = append(avNames, id)
							}
						}
					}
				} else if arr, ok := stageMap["avs"].([]interface{}); ok && len(arr) > 0 {
					avNames = append(avNames, arr...)
				}

				fmt.Println(avNames)
				progress := map[string]interface{}{
					"type":       "AV_SCAN",
					"status":     "RUNNING",
					"avScanData": stageMap["avScanData"],
				}
				UpdateStageProgressArray(taskID, "AV_SCAN", progress)
				emitWorkflowProgress(userID, taskID)
				data := map[string]any{
					"task_id":   taskID,
					"scan_path": avFilePath,
					"av_names":  avNames,
				}

				go HandleScanning(client, data)
				waitForStageCompletion(taskID, "AV_SCAN")
			}

			logger.LogAutomationStage(taskID, stageType, "completed", 0)
		}

		// Workflow complete
		var taskProgress models.TaskProgress
		err := config.DB.Where("task_id = ?", taskID).First(&taskProgress).Error
		var progressArr []interface{}
		if err == nil {
			err2 := json.Unmarshal([]byte(taskProgress.Progress), &progressArr)
			if err2 != nil {
				progressArr = stageProgress // fallback to original if error
			}
		} else {
			progressArr = stageProgress // fallback to original if error
		}
		sockets.EmitToUser(userID, "workflow_complete", map[string]any{
			"task_id":  taskID,
			"message":  "Workflow complete",
			"progress": progressArr,
			"end_time": time.Now().Format(time.RFC3339),
		})
	}()
}

// Wait for a stage completion event using a channel (race-safe, with timeout)
func waitForStageCompletion(taskID, event string) {
	key := taskID + ":" + event

	stageMu.Lock()
	// If a completion was already signaled early, consume the flag and return immediately
	if stageDoneFlags[key] {
		delete(stageDoneFlags, key)
		stageMu.Unlock()
		fmt.Println("Already completed:", event)
		return
	}
	// Create and store channel
	ch := make(chan struct{})
	stageDoneChans[key] = ch
	stageMu.Unlock()

	fmt.Println("Waiting:", event)

	ctx, cancel := context.WithTimeout(context.Background(), stageWaitTimeout)
	defer cancel()

	select {
	case <-ch:
		// normal completion
	case <-ctx.Done():
		fmt.Println("Timeout waiting:", event)
	}

	// Cleanup
	stageMu.Lock()
	delete(stageDoneChans, key)
	stageMu.Unlock()
	fmt.Println("Deleting:", event)
}

// Call this from the appropriate place in each handler when the stage is actually complete
func SignalStageComplete(taskID, event string) {
	fmt.Println("Completed", event)
	key := taskID + ":" + event

	stageMu.Lock()
	defer stageMu.Unlock()

	if ch, ok := stageDoneChans[key]; ok {
		// Idempotent close
		select {
		case <-ch:
			// already closed
		default:
			close(ch)
		}
		delete(stageDoneChans, key)
		return
	}
	// No waiter yet; mark completed so a late waiter will return immediately
	stageDoneFlags[key] = true
}

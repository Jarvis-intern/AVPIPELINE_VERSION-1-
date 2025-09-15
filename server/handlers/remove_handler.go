package handlers

import (
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"encoding/json"

	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
	"gorm.io/gorm"
)

type RemovalTypeResult struct {
	Type             string   `json:"type"`
	Status           string   `json:"status"`
	TotalFiles       int      `json:"totalFiles"`
	RemovedFiles     int      `json:"removedFiles"`
	FailedFiles      int      `json:"failedFiles"`
	RemovedFilesList []string `json:"removedFilesList"`
	FailedFilesList  []string `json:"failedFilesList"`
	Error            string   `json:"error,omitempty"`
}

// Helper to get current removalResults from DB
func getRemovalResultsFromDB(taskID string) ([]RemovalTypeResult, error) {
	var progress models.TaskProgress
	err := config.DB.Where("task_id = ?", taskID).First(&progress).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	var progressArr []map[string]interface{}
	if err := json.Unmarshal([]byte(progress.Progress), &progressArr); err != nil {
		return nil, err
	}
	for _, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == "REMOVAL" {
			if cr, ok := stage["removalResults"]; ok {
				crBytes, _ := json.Marshal(cr)
				var results []RemovalTypeResult
				if err := json.Unmarshal(crBytes, &results); err == nil {
					return results, nil
				}
			}
		}
	}
	return nil, nil
}

// Helper to update removalResults in the progress array
func updateRemovalResultsInDB(taskID string, updatedResults []RemovalTypeResult, updateFields map[string]interface{}) error {
	var progress models.TaskProgress
	err := config.DB.Where("task_id = ?", taskID).First(&progress).Error
	if err != nil {
		return err
	}
	var progressArr []map[string]interface{}
	if err := json.Unmarshal([]byte(progress.Progress), &progressArr); err != nil {
		return err
	}
	for i, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == "REMOVAL" {
			stage["removalResults"] = updatedResults
			for k, v := range updateFields {
				stage[k] = v
			}
			progressArr[i] = stage
		}
	}
	newProgressBytes, _ := json.Marshal(progressArr)
	progress.Progress = string(newProgressBytes)
	return config.DB.Save(&progress).Error
}

func HandleRemoveFiles(client *sockets.Client, data map[string]any) {
	folderPathRaw, ok := data["folder_path"]
	if !ok {
		log.Fatalf("Error: 'folder_path' not found in request")
		sockets.EmitError(client, "Missing field: folder_path", "removal_error")
		return
	}

	folderPath, ok := folderPathRaw.(string)
	if !ok || folderPath == "" {
		log.Fatalf("Error: Invalid 'folder_path' in request")
		sockets.EmitError(client, "Invalid folder path", "removal_error")
		return
	}

	rawList, ok := data["removal_list"].([]interface{})
	if !ok {
		log.Fatalf("Error: 'removal_list' is not a valid list")
		sockets.EmitError(client, "Invalid or missing removal list", "removal_error")
		return
	}

	removalList := make([]string, 0, len(rawList))
	for i, v := range rawList {
		strVal, ok := v.(string)
		if !ok {
			log.Printf("Warning: Skipping non-string entry at index %d", i)
			continue
		}
		removalList = append(removalList, strVal)
	}

	userID := client.UserID
	if userID == "" {
		sockets.EmitError(client, "User ID is required for Removal", "removal_error")
		return
	}

	taskID, _ := data["task_id"].(string)

	var total_removal_files = 0
	var total_removed_count = 0
	total_types := len(removalList)

	for _, removalType := range removalList {
		removalFiles, err := countRemovalTypeFiles(folderPath, removalType)
		if err != nil {
			sockets.EmitError(client, err.Error(), "removal_error")
			return
		}
		total_removal_files += removalFiles
	}

	// Prepare initial removalResults array
	removalResults := []RemovalTypeResult{}
	for _, removalType := range removalList {
		removalResults = append(removalResults, RemovalTypeResult{
			Type:             strings.ToUpper(removalType),
			Status:           "pending",
			TotalFiles:       0,
			RemovedFiles:     0,
			FailedFiles:      0,
			RemovedFilesList: []string{},
			FailedFilesList:  []string{},
		})
	}

	sockets.EmitToUser(userID, "removal_started", map[string]any{
		"total_types":         total_types,
		"total_removal_files": total_removal_files,
		"start_time":          time.Now().Format(time.RFC3339),
	})
	if taskID != "" {
		removalProgress := map[string]interface{}{
			"type":               "REMOVAL",
			"status":             "RUNNING",
			"progress":           0,
			"currRemovalType":    "",
			"currTypeFilesCount": 0,
			"currTypeNumber":     0,
			"totalTypes":         total_types,
			"totalRemovalFiles":  total_removal_files,
			"totalRemovedCount":  total_removed_count,
			"message":            "Starting removal",
			"removalResults":     removalResults,
		}
		UpdateStageProgressArray(taskID, "REMOVAL", removalProgress)
	}

	for i, removalType := range removalList {
		removalFiles, err := countRemovalTypeFiles(folderPath, removalType)
		if err != nil {
			for j, r := range removalResults {
				if r.Type == strings.ToUpper(removalType) {
					removalResults[j].Status = "error"
					removalResults[j].Error = err.Error()
				}
			}
			UpdateStageProgressArray(taskID, "REMOVAL", map[string]interface{}{
				"type":               "REMOVAL",
				"status":             "ERROR",
				"progress":           0,
				"currRemovalType":    removalType,
				"currTypeFilesCount": 0,
				"currTypeNumber":     0,
				"totalTypes":         total_types,
				"totalRemovalFiles":  total_removal_files,
				"totalRemovedCount":  total_removed_count,
				"message":            err.Error(),
				"removalResults":     removalResults,
			})
			sockets.EmitError(client, err.Error(), "removal_error")
			return
		}
		// Mark running
		for j, r := range removalResults {
			if r.Type == strings.ToUpper(removalType) {
				removalResults[j].Status = "running"
				removalResults[j].TotalFiles = removalFiles
			}
		}
		UpdateStageProgressArray(taskID, "REMOVAL", map[string]interface{}{
			"type":               "REMOVAL",
			"status":             "RUNNING",
			"progress":           0,
			"currRemovalType":    removalType,
			"currTypeFilesCount": removalFiles,
			"currTypeNumber":     0,
			"totalTypes":         total_types,
			"totalRemovalFiles":  total_removal_files,
			"totalRemovedCount":  total_removed_count,
			"message":            "Removing files of type " + removalType,
			"removalResults":     removalResults,
		})
		sockets.EmitToUser(userID, "removal_type_started", map[string]any{
			"removal_type":        removalType,
			"curr_type_number":    i + 1,
			"total_types":         total_types,
			"curr_type_files":     removalFiles,
			"total_removal_files": total_removal_files,
			"total_removed_count": total_removed_count,
			"removalResults":      removalResults,
			"start_time":          time.Now().Format(time.RFC3339),
		})
		removedCount, err := removeRemovalTypeFiles(folderPath, removalType)
		if err != nil {
			for j, r := range removalResults {
				if r.Type == strings.ToUpper(removalType) {
					removalResults[j].Status = "error"
					removalResults[j].Error = err.Error()
				}
			}
			UpdateStageProgressArray(taskID, "REMOVAL", map[string]interface{}{
				"type":               "REMOVAL",
				"status":             "ERROR",
				"progress":           0,
				"currRemovalType":    removalType,
				"currTypeFilesCount": removalFiles,
				"currTypeNumber":     0,
				"totalTypes":         total_types,
				"totalRemovalFiles":  total_removal_files,
				"totalRemovedCount":  total_removed_count,
				"message":            err.Error(),
				"removalResults":     removalResults,
			})
			sockets.EmitError(client, err.Error(), "removal_error")
			return
		}
		total_removed_count += removedCount
		// Mark completed
		for j, r := range removalResults {
			if r.Type == strings.ToUpper(removalType) {
				removalResults[j].Status = "completed"
				removalResults[j].RemovedFiles = removedCount
				// Optionally, populate RemovedFilesList if you want to track file names
			}
		}
		UpdateStageProgressArray(taskID, "REMOVAL", map[string]interface{}{
			"type":               "REMOVAL",
			"status":             "RUNNING",
			"progress":           0,
			"currRemovalType":    removalType,
			"currTypeFilesCount": removalFiles,
			"currTypeNumber":     0,
			"totalTypes":         total_types,
			"totalRemovalFiles":  total_removal_files,
			"totalRemovedCount":  total_removed_count,
			"message":            "Completed removal for type " + removalType,
			"removalResults":     removalResults,
		})
		sockets.EmitToUser(userID, "removal_type_complete", map[string]any{
			"removal_type":        removalType,
			"curr_type_number":    i + 1,
			"total_types":         total_types,
			"removed_count":       removedCount,
			"total_removal_files": total_removal_files,
			"total_removed_count": total_removed_count,
			"removalResults":      removalResults,
			"end_time":            time.Now().Format(time.RFC3339),
		})
	}
	// Mark all as done
	UpdateStageProgressArray(taskID, "REMOVAL", map[string]interface{}{
		"type":               "REMOVAL",
		"status":             "DONE",
		"progress":           100,
		"currRemovalType":    "",
		"currTypeFilesCount": 0,
		"currTypeNumber":     total_types,
		"totalTypes":         total_types,
		"totalRemovalFiles":  total_removal_files,
		"totalRemovedCount":  total_removed_count,
		"message":            "Removal complete",
		"end_time":           time.Now().Format(time.RFC3339),
		"removalResults":     removalResults,
	})

	sockets.EmitToUser(userID, "removal_complete", map[string]any{
		"total_removal_files": total_removal_files,
		"total_removed_count": total_removed_count,
		"removalResults":      removalResults,
		"end_time":            time.Now().Format(time.RFC3339),
	})
	SignalStageComplete(taskID, "REMOVAL")
	if taskID != "" {
		removalProgress := map[string]interface{}{
			"type":               "REMOVAL",
			"status":             "DONE",
			"progress":           100,
			"currRemovalType":    "",
			"currTypeFilesCount": 0,
			"currTypeNumber":     total_types,
			"totalTypes":         total_types,
			"totalRemovalFiles":  total_removal_files,
			"totalRemovedCount":  total_removed_count,
			"message":            "Removal complete",
			"end_time":           time.Now().Format(time.RFC3339),
			"removalResults":     removalResults,
		}
		UpdateStageProgressArray(taskID, "REMOVAL", removalProgress)
	}
}

func countRemovalTypeFiles(folderPath string, removalType string) (int, error) {
	// Check if folder exists
	info, err := os.Stat(folderPath)
	if os.IsNotExist(err) {
		return 0, fmt.Errorf("folder not found: %s", folderPath)
	}
	if err != nil {
		return 0, err // Other errors like permission denied
	}
	if !info.IsDir() {
		return 0, fmt.Errorf("path is not a directory: %s", folderPath)
	}

	count := 0
	err = filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err // Propagate internal walk errors
		}
		if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), removalType) {
			count++
		}
		return nil
	})

	if err != nil {
		return 0, err // Any walking error
	}

	return count, nil
}

func removeRemovalTypeFiles(folderPath string, removalType string) (int, error) {
	removedCount := 0
	err := filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err // Propagate walk error
		}
		if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), removalType) {
			removeErr := os.Remove(path)
			if removeErr != nil {
				fmt.Printf("Failed to remove: %s (error: %v)\n", path, removeErr)
				return removeErr // Stop on first deletion error (or change to continue)
			}
			removedCount++
		}
		return nil
	})

	if err != nil {
		return removedCount, fmt.Errorf("error during removal: %w", err)
	}

	return removedCount, nil
}

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

type VerifyRemovalTypeResult struct {
	Type             string   `json:"type"`
	Status           string   `json:"status"`
	TotalFiles       int      `json:"totalFiles"`
	RemovedFiles     int      `json:"removedFiles"`
	FailedFiles      int      `json:"failedFiles"`
	RemovedFilesList []string `json:"removedFilesList"`
	FailedFilesList  []string `json:"failedFilesList"`
	Error            string   `json:"error,omitempty"`
}

// Helper to get current verifyRemovalResults from DB
func getVerifyRemovalResultsFromDB(taskID string) ([]VerifyRemovalTypeResult, error) {
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
		if t, ok := stage["type"].(string); ok && t == "VERIFY_REMOVAL" {
			if cr, ok := stage["verifyRemovalResults"]; ok {
				crBytes, _ := json.Marshal(cr)
				var results []VerifyRemovalTypeResult
				if err := json.Unmarshal(crBytes, &results); err == nil {
					return results, nil
				}
			}
		}
	}
	return nil, nil
}

// Helper to update verifyRemovalResults in the progress array
func updateVerifyRemovalResultsInDB(taskID string, updatedResults []VerifyRemovalTypeResult, updateFields map[string]interface{}) error {
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
		if t, ok := stage["type"].(string); ok && t == "VERIFY_REMOVAL" {
			stage["verifyRemovalResults"] = updatedResults
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

func HandleVerifyRemoveFiles(client *sockets.Client, data map[string]any) {
	folderPathRaw, ok := data["folder_path"]
	if !ok {
		log.Fatalf("Error: 'folder_path' not found in request")
		sockets.EmitError(client, "Missing field: folder_path", "verify_removal_error")
		return
	}

	folderPath, ok := folderPathRaw.(string)
	if !ok || folderPath == "" {
		log.Fatalf("Error: Invalid 'folder_path' in request")
		sockets.EmitError(client, "Invalid folder path", "verify_removal_error")
		return
	}

	rawList, ok := data["verify_removal_list"].([]interface{})
	if !ok {
		log.Fatalf("Error: 'verify_removal_list' is not a valid list")
		sockets.EmitError(client, "Invalid or missing verify removal list", "verify_removal_error")
		return
	}

	verifyRemovalList := make([]string, 0, len(rawList))
	for i, v := range rawList {
		strVal, ok := v.(string)
		if !ok {
			log.Printf("Warning: Skipping non-string entry at index %d", i)
			continue
		}
		verifyRemovalList = append(verifyRemovalList, strVal)
	}

	userID := client.UserID
	if userID == "" {
		sockets.EmitError(client, "User ID is required for Verify Removal", "verify_removal_error")
		return
	}

	taskID, _ := data["task_id"].(string)

	var total_verify_removal_files = 0
	var total_removed_count = 0
	total_types := len(verifyRemovalList)

	// Prepare initial verifyRemovalResults array
	verifyRemovalResults := []VerifyRemovalTypeResult{}
	for _, verifyRemovalType := range verifyRemovalList {
		verifyRemovalResults = append(verifyRemovalResults, VerifyRemovalTypeResult{
			Type:             strings.ToUpper(verifyRemovalType),
			Status:           "pending",
			TotalFiles:       0,
			RemovedFiles:     0,
			FailedFiles:      0,
			RemovedFilesList: []string{},
			FailedFilesList:  []string{},
		})
	}

	sockets.EmitToUser(userID, "verify_removal_started", map[string]any{
		"total_types":                total_types,
		"total_verify_removal_files": total_verify_removal_files,
		"start_time":                 time.Now().Format(time.RFC3339),
	})

	for i, verifyRemovalType := range verifyRemovalList {
		verifyRemovalFiles, err := countVerifyRemovalTypeFiles(folderPath, verifyRemovalType)
		if err != nil {
			for j, r := range verifyRemovalResults {
				if r.Type == strings.ToUpper(verifyRemovalType) {
					verifyRemovalResults[j].Status = "error"
					verifyRemovalResults[j].Error = err.Error()
				}
			}
			UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", map[string]interface{}{
				"type":                    "VERIFY_REMOVAL",
				"status":                  "ERROR",
				"progress":                0,
				"currVerifyRemovalType":   verifyRemovalType,
				"currTypeFilesCount":      0,
				"currTypeNumber":          0,
				"totalTypes":              len(verifyRemovalList),
				"totalVerifyRemovalFiles": total_verify_removal_files,
				"totalRemovedCount":       total_removed_count,
				"message":                 err.Error(),
				"verifyRemovalResults":    verifyRemovalResults,
			})
			sockets.EmitError(client, err.Error(), "verify_removal_error")
			return
		}
		total_verify_removal_files += verifyRemovalFiles
		// Mark running
		for j, r := range verifyRemovalResults {
			if r.Type == strings.ToUpper(verifyRemovalType) {
				verifyRemovalResults[j].Status = "running"
				verifyRemovalResults[j].TotalFiles = verifyRemovalFiles
			}
		}
		UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", map[string]interface{}{
			"type":                    "VERIFY_REMOVAL",
			"status":                  "RUNNING",
			"progress":                0,
			"currVerifyRemovalType":   verifyRemovalType,
			"currTypeFilesCount":      verifyRemovalFiles,
			"currTypeNumber":          0,
			"totalTypes":              len(verifyRemovalList),
			"totalVerifyRemovalFiles": total_verify_removal_files,
			"totalRemovedCount":       total_removed_count,
			"message":                 "Verifying removal for type " + verifyRemovalType,
			"verifyRemovalResults":    verifyRemovalResults,
		})
		sockets.EmitToUser(userID, "verify_removal_type_started", map[string]any{
			"verify_removal_type":        verifyRemovalType,
			"curr_type_number":           i + 1,
			"total_types":                total_types,
			"curr_type_files":            verifyRemovalFiles,
			"total_verify_removal_files": total_verify_removal_files,
			"total_removed_count":        total_removed_count,
			"verifyRemovalResults":       verifyRemovalResults,
			"start_time":                 time.Now().Format(time.RFC3339),
		})
		removedCount, err := removeVerifyRemovalTypeFiles(folderPath, verifyRemovalType)
		if err != nil {
			for j, r := range verifyRemovalResults {
				if r.Type == strings.ToUpper(verifyRemovalType) {
					verifyRemovalResults[j].Status = "error"
					verifyRemovalResults[j].Error = err.Error()
				}
			}
			UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", map[string]interface{}{
				"type":                    "VERIFY_REMOVAL",
				"status":                  "ERROR",
				"progress":                0,
				"currVerifyRemovalType":   verifyRemovalType,
				"currTypeFilesCount":      verifyRemovalFiles,
				"currTypeNumber":          0,
				"totalTypes":              len(verifyRemovalList),
				"totalVerifyRemovalFiles": total_verify_removal_files,
				"totalRemovedCount":       total_removed_count,
				"message":                 err.Error(),
				"verifyRemovalResults":    verifyRemovalResults,
			})
			sockets.EmitError(client, err.Error(), "verify_removal_error")
			return
		}
		total_removed_count += removedCount
		// Mark completed
		for j, r := range verifyRemovalResults {
			if r.Type == strings.ToUpper(verifyRemovalType) {
				verifyRemovalResults[j].Status = "completed"
				verifyRemovalResults[j].RemovedFiles = removedCount
				// Optionally, populate RemovedFilesList if you want to track file names
			}
		}
		UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", map[string]interface{}{
			"type":                    "VERIFY_REMOVAL",
			"status":                  "RUNNING",
			"progress":                0,
			"currVerifyRemovalType":   verifyRemovalType,
			"currTypeFilesCount":      verifyRemovalFiles,
			"currTypeNumber":          0,
			"totalTypes":              len(verifyRemovalList),
			"totalVerifyRemovalFiles": total_verify_removal_files,
			"totalRemovedCount":       total_removed_count,
			"message":                 "Completed verify removal for type " + verifyRemovalType,
			"verifyRemovalResults":    verifyRemovalResults,
		})
		sockets.EmitToUser(userID, "verify_removal_type_complete", map[string]any{
			"verify_removal_type":        verifyRemovalType,
			"curr_type_number":           i + 1,
			"total_types":                total_types,
			"removed_count":              removedCount,
			"total_verify_removal_files": total_verify_removal_files,
			"total_removed_count":        total_removed_count,
			"verifyRemovalResults":       verifyRemovalResults,
			"end_time":                   time.Now().Format(time.RFC3339),
		})
	}
	// Mark all as done
	UpdateStageProgressArray(taskID, "VERIFY_REMOVAL", map[string]interface{}{
		"type":                    "VERIFY_REMOVAL",
		"status":                  "DONE",
		"progress":                100,
		"currVerifyRemovalType":   "",
		"currTypeFilesCount":      0,
		"currTypeNumber":          len(verifyRemovalList),
		"totalTypes":              len(verifyRemovalList),
		"totalVerifyRemovalFiles": total_verify_removal_files,
		"totalRemovedCount":       total_removed_count,
		"message":                 "Verify removal complete",
		"end_time":                time.Now().Format(time.RFC3339),
		"verifyRemovalResults":    verifyRemovalResults,
	})

	sockets.EmitToUser(userID, "verify_removal_complete", map[string]any{
		"path":                       folderPath,
		"total_verify_removal_files": total_verify_removal_files,
		"total_removed_count":        total_removed_count,
		"verifyRemovalResults":       verifyRemovalResults,
		"end_time":                   time.Now().Format(time.RFC3339),
	})
	SignalStageComplete(taskID, "VERIFY_REMOVAL")
}

func countVerifyRemovalTypeFiles(folderPath string, verifyRemovalType string) (int, error) {
	info, err := os.Stat(folderPath)
	if os.IsNotExist(err) {
		return 0, fmt.Errorf("folder not found: %s", folderPath)
	}
	if err != nil {
		return 0, err
	}
	if !info.IsDir() {
		return 0, fmt.Errorf("path is not a directory: %s", folderPath)
	}

	count := 0
	err = filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), verifyRemovalType) {
			count++
		}
		return nil
	})

	if err != nil {
		return 0, err
	}

	return count, nil
}

func removeVerifyRemovalTypeFiles(folderPath string, verifyRemovalType string) (int, error) {
	removedCount := 0
	err := filepath.WalkDir(folderPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(strings.ToLower(d.Name()), verifyRemovalType) {
			removeErr := os.Remove(path)
			if removeErr != nil {
				fmt.Printf("Failed to remove: %s (error: %v)\n", path, removeErr)
				return removeErr
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

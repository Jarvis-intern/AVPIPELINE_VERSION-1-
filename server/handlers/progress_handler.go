package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gorm.io/gorm"
)

// POST /api/task-progress
func CreateOrUpdateTaskProgress(c *gin.Context) {
	var req struct {
		TaskID   string `json:"task_id"`
		Progress string `json:"progress"` // JSON string
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	if err := updateOrCreateTaskProgress(req.TaskID, req.Progress); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update or create progress"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Progress updated"})
}

// GET /api/task-progress/:task_id
func GetTaskProgress(c *gin.Context) {
	taskID := c.Param("task_id")
	tp, err := models.GetTaskProgress(config.DB, taskID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Return empty (first access) instead of 404 to avoid frontend error loops
			c.JSON(http.StatusOK, gin.H{
				"task_id":  taskID,
				"Progress": "[]",
				"message":  "no progress yet",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to query progress"})
		return
	}
	c.JSON(http.StatusOK, tp)
}

// UpdateOrCreateTaskProgress updates or creates a TaskProgress entry for a given taskID and progress JSON string
func updateOrCreateTaskProgress(taskID string, progress string) error {
	db := config.DB

	// Always resolve SystemIP from the Task (Task.UniqueID == taskID)
	var task models.Task
	if err := db.Where("unique_id = ?", taskID).First(&task).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			// Fallback dummy IP (still satisfies NOT NULL); better to enforce task creation first
			task.SystemIP = "0.0.0.0"
		} else {
			return fmt.Errorf("failed to fetch task for system ip: %w", err)
		}
	}

	tp, err := models.GetTaskProgress(db, taskID)
	if err == nil && tp != nil && tp.ID != 0 {
		// Exists: update progress; ensure SystemIP set if previously empty
		updateData := map[string]interface{}{"progress": progress}
		if tp.SystemIP == "" {
			updateData["system_ip"] = task.SystemIP
		}
		return db.Model(&models.TaskProgress{}).
			Where("task_id = ?", taskID).
			Updates(updateData).Error
	}

	// Create new
	tpNew := models.TaskProgress{
		TaskID:   taskID,
		SystemIP: task.SystemIP,
		Progress: progress,
	}
	return tpNew.Create(db)
}

// ExtractionProgress, ConversionProgress, etc. (define all as per frontend)

func UpdateStageProgressArray(taskID string, stageType string, newStageObj map[string]interface{}) error {
	db := config.DB
	// Get current progress array
	tp, err := models.GetTaskProgress(db, taskID)
	var progressArr []map[string]interface{}
	if err == nil && tp != nil && tp.ID != 0 && tp.Progress != "" {
		if err := json.Unmarshal([]byte(tp.Progress), &progressArr); err != nil {
			progressArr = []map[string]interface{}{}
		}
	} else {
		progressArr = []map[string]interface{}{}
	}

	// Update or insert the stage object
	found := false
	for i, stage := range progressArr {
		if t, ok := stage["type"].(string); ok && t == stageType {
			progressArr[i] = newStageObj
			found = true
			break
		}
	}
	if !found {
		progressArr = append(progressArr, newStageObj)
	}

	// Marshal and save
	progressJSON, err := json.Marshal(progressArr)
	if err != nil {
		return fmt.Errorf("failed to marshal progress array: %w", err)
	}
	return updateOrCreateTaskProgress(taskID, string(progressJSON))
}

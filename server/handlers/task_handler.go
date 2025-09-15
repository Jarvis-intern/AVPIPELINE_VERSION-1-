package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
	"gitlab.com/magnetite1/av-pipeline/server/utils"
	"gorm.io/gorm"
)

func GetTask(c *gin.Context) {
	uniqueID := c.Param("task_unique_id")

	// Use the existing model function that includes all relationships
	task, err := models.GetTaskByUniqueID(uniqueID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"task": task})
}

func TaskInitialisation(c *gin.Context) {
	type ReqBody struct {
		TaskUniqueID string `json:"task_unique_id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Assignee     string `json:"assignee"`
		SystemIP     string `json:"system_ip"`
	}

	var body ReqBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var task models.Task

	if body.TaskUniqueID != "" {
		err := config.DB.Where("unique_id = ?", body.TaskUniqueID).First(&task).Error
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
		task.Name = body.Name
		task.Description = body.Description
		task.Assignee = body.Assignee
		task.SystemIP = body.SystemIP

		if err := config.DB.Save(&task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
			return
		}
	} else {
		// Generate unique ID if not provided
		uniqueID, err := utils.GenerateTaskUniqueID()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate unique ID"})
			return
		}

		task = models.Task{
			UniqueID:    uniqueID,
			Name:        body.Name,
			Description: body.Description,
			Assignee:    body.Assignee,
			SystemIP:    body.SystemIP,
		}

		if err := config.DB.Create(&task).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
			return
		}

		// Reload the task with user data for the response
		if err := config.DB.Where("unique_id = ?", task.UniqueID).First(&task).Error; err != nil {
			// If preload fails, still return the unique_id but log the error
			c.JSON(http.StatusOK, gin.H{"task_unique_id": task.UniqueID})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"task_unique_id": task.UniqueID,
		"task":           task,
	})
}

func AddFilePath(c *gin.Context) {
	type ReqBody struct {
		UniqueID   string `json:"unique_id"`
		FilePath   string `json:"file_path"`
		AvFilePath string `json:"av_file_path"`
	}

	var body ReqBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var task models.Task
	err := config.DB.Where("unique_id = ?", body.UniqueID).First(&task).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	task.FilePath = body.FilePath
	task.AvFilePath = body.AvFilePath

	if err := config.DB.Save(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task file path"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File path added successfully"})
}

func CreateWorkflow(c *gin.Context) {
	type ReqBody struct {
		UniqueID      string   `json:"unique_id"`
		Stage1        uint     `json:"stage1"`
		Stage2        uint     `json:"stage2"`
		Stage3        uint     `json:"stage3"`
		Stage4        uint     `json:"stage4"`
		Stage5        uint     `json:"stage5"`
		Stage6        uint     `json:"stage6"`
		Conversion    []string `json:"conversion"`
		Removal       []string `json:"removal"`
		VerifyRemoval []string `json:"verify_removal"`
		AutoProceed   bool     `json:"auto_proceed"`
		AVs           []string `json:"avs"`
	}

	var body ReqBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var task models.Task
	err := config.DB.Where("unique_id = ?", body.UniqueID).First(&task).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	task.Stage1 = &body.Stage1
	task.Stage2 = &body.Stage2
	task.Stage3 = &body.Stage3
	task.Stage4 = &body.Stage4
	task.Stage5 = &body.Stage5
	task.Stage6 = &body.Stage6
	task.Conversion = body.Conversion
	task.Removal = body.Removal
	task.VerifyRemoval = body.VerifyRemoval
	task.AutoProceed = body.AutoProceed
	task.AVs = body.AVs

	if err := config.DB.Save(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update workflow details"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "successfully added workflow details"})
}

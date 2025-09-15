package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/models"
)

func GetAllStages(c *gin.Context) {
	stages, err := models.GetAllStages()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve stages"})
		return
	}
	c.JSON(http.StatusOK, stages)
}

func CreateStage(c *gin.Context) {
	var input struct {
		Name string `json:"name"`
	}
	if err := c.ShouldBindJSON(&input); err != nil || input.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing or invalid 'name'"})
		return
	}

	existing, err := models.FindStageByName(input.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stage already exists"})
		return
	}

	stage := models.Stage{Name: input.Name}
	if err := stage.Create(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create stage"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Successfully created stage"})
}

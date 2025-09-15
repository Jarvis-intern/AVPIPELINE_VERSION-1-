package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/models"
)

func GetScanDetails(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID"})
		return
	}

	var scanDetails models.ScanDetails
	if err := scanDetails.GetByID(uint(id)); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scan details not found"})
		return
	}
	c.JSON(http.StatusOK, scanDetails)
}

func GetScanDetailsByTaskID(c *gin.Context) {
	taskID := c.Param("task_id")

	var scanDetails []models.ScanDetails
	if err := config.DB.Where("task_id = ?", taskID).Find(&scanDetails).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scan details not found"})
		return
	}
	c.JSON(http.StatusOK, scanDetails)
}

func GetScanDetailsByAVID(c *gin.Context) {
	avIDParam := c.Param("av_id")
	avID, err := strconv.ParseUint(avIDParam, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid AV ID"})
		return
	}

	var scanDetails []models.ScanDetails
	if err := config.DB.Where("av_id = ?", avID).Find(&scanDetails).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scan details not found"})
		return
	}
	c.JSON(http.StatusOK, scanDetails)
}

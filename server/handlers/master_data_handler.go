package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/models"
)

type MasterDataColumn string

const (
	ZIP            MasterDataColumn = "zip"
	CONVERSION     MasterDataColumn = "conversion"
	REMOVAL        MasterDataColumn = "removal"
	VERIFY_REMOVAL MasterDataColumn = "verify_removal"
)

func isValidColumn(column string) bool {
	switch MasterDataColumn(column) {
	case ZIP, CONVERSION, REMOVAL, VERIFY_REMOVAL:
		return true
	default:
		return false
	}
}

func GetMasterDataWithAvs(c *gin.Context) {
	masterData, err := models.GetMasterDataWithAvs()
	// fmt.Println(masterData[0])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"failed to fetch master data": err})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"zip":            masterData.Zip,
		"conversion":     masterData.Conversion,
		"removal":        masterData.Removal,
		"verify_removal": masterData.VerifyRemoval,
		"avs":            masterData.AVS,
	})
}
func GetMasterData(c *gin.Context) {
	masterData, err := models.GetMasterData()
	// fmt.Println(masterData[0])
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"failed to fetch master data": err})
		return
	}

	c.JSON(http.StatusOK, map[string]interface{}{
		"zip":            masterData.Zip,
		"conversion":     masterData.Conversion,
		"removal":        masterData.Removal,
		"verify_removal": masterData.VerifyRemoval,
	})
}

func AddOptions(c *gin.Context) {
	var body map[string][]string
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	for key, values := range body {

		if !isValidColumn(key) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid col_name"})
			return
		}

		// Validate that colValues is a slice
		if values == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "values should be an array"})
			return
		}

		// Get the first row of master data
		data, err := models.GetMasterData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to get master data"})

			return
		}

		// Add options using the model method
		if err := data.AddOptions(key, values); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to add options"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message": "successfully added options"})
}

func RemoveOptions(c *gin.Context) {
	var body map[string][]string
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Validate and process each key-value pair
	for key, values := range body {
		// Validate column name first (matches Python validation)
		if !isValidColumn(key) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid col_name"})
			return
		}

		// Validate that colValues is a slice
		if values == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Values should be array"})
			return
		}

		// Get the first row of master data
		data, err := models.GetMasterData()
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to get master data"})
			return
		}

		// Remove options using the model method
		if err := data.RemoveOptions(key, values); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to remove options"})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{"message": "successfully removed options"})
}

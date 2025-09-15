// file: server/routes/router.go

package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func RegisterRoutes(router *gin.Engine) {
	api := router.Group("/api")

	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	{
		AVRoutes(api.Group("/av"))
		MasterDataRoutes(api.Group("/master-data"))
		StageRoutes(api.Group("/stage"))
		TaskRoutes(api.Group("/task"))
		SystemRoutes(api.Group("/system-info"))
		api.POST("/task-progress", handlers.CreateOrUpdateTaskProgress)
		api.GET("/task-progress/:task_id", handlers.GetTaskProgress)

		// *** FIX STARTS HERE: Add conversion route ***
		conversionGroup := api.Group("/convert")
		{
			conversionGroup.POST("/upload", handlers.HandleConversionUpload)
		}
		// *** FIX ENDS HERE ***
	}
}

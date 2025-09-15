package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func TaskRoutes(rg *gin.RouterGroup) {
	rg.GET("/:task_unique_id", handlers.GetTask)
	rg.POST("/task-initialisation", handlers.TaskInitialisation)
	rg.POST("/create-workflow", handlers.CreateWorkflow)
	rg.POST("/add-file-path", handlers.AddFilePath)
}

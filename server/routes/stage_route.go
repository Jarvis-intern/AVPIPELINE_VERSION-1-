package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func StageRoutes(rg *gin.RouterGroup) {
	rg.GET("/", handlers.GetAllStages)
	rg.GET("/all", handlers.CreateStage)
}

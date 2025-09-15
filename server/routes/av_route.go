package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func AVRoutes(rg *gin.RouterGroup) {
	rg.GET("/", handlers.GetAVs)
	rg.GET("/:id", handlers.GetAVByID)
	rg.POST("/", handlers.CreateAV)
	rg.PUT("/:id", handlers.UpdateAV)
	rg.DELETE("/:id", handlers.DeleteAV)
}

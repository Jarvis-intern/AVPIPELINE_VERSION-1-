package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func MasterDataRoutes(rg *gin.RouterGroup) {
	rg.GET("/", handlers.GetMasterDataWithAvs)
	rg.POST("/", handlers.AddOptions)
	rg.DELETE("/", handlers.RemoveOptions)
}

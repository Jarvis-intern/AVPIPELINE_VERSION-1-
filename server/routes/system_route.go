package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

func SystemRoutes(rg *gin.RouterGroup) {
	rg.GET("/ip-address", handlers.GetIPAddress)
	rg.GET("/system-usage", handlers.GetSystemUsage)
}

package routes

import (
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
)

// WebSocketRoute registers the WebSocket route
func RegisterWebsocketRoutes(router *gin.Engine) {
	ws := router.Group("/ws")

	{
		ws.GET("/", handlers.WebSocketHandler)
	}
}

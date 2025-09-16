package main

import (
	"log"
	"os"
	"os/exec"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gitlab.com/magnetite1/av-pipeline/server/config"
	"gitlab.com/magnetite1/av-pipeline/server/db"
	"gitlab.com/magnetite1/av-pipeline/server/logger"
	"gitlab.com/magnetite1/av-pipeline/server/handlers"
	"gitlab.com/magnetite1/av-pipeline/server/routes"
	"gitlab.com/magnetite1/av-pipeline/server/sockets"
)

func main() {
	log.Printf("Starting server with Python interpreter: %s", getPythonInterpreter())

	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		config.InitDB()
		db.InitializeDatabase()
		db.SeedData()
		log.Println("Database migrated and seeded.")
		return
	}

	config.InitDB()
	db.InitializeDatabase()
	db.SeedData()
	handlers.StartSystemMetricsStreamer()

	// Start WebSocket hub
	go sockets.Hub.Start()

	r := gin.Default()

	// Configure CORS
	corsConfig := config.GetCORSConfig()
	r.Use(cors.New(corsConfig))

	// Register all other routes
	routes.RegisterRoutes(r)
	// routes.RegisterWebsocketRoutes(r)
	r.GET("/ws", handlers.WebSocketHandler)

	if err := logger.InitActivityLogger(); err != nil {
		log.Printf("Failed to init activity logger: %v", err)
	}

	// After router creation:
	handlers.RegisterActivityRoutes(r)

	log.Println("Server starting on :8000")
	r.Run(":8000")
}

func getPythonInterpreter() string {
	// Try python3 first (common on Ubuntu)
	if _, err := exec.LookPath("python3"); err == nil {
		return "python3"
	}
	// Fallback to python
	return "python"
}

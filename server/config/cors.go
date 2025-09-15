package config

import (
	"os"
	"strings"

	"github.com/gin-contrib/cors"
)

// GetCORSConfig returns CORS configuration based on environment
func GetCORSConfig() cors.Config {
	// Get allowed origins from environment variable or use defaults
	allowedOrigins := getEnvSlice("CORS_ALLOWED_ORIGINS", []string{
		"*", // Allow all origins
	})

	config := cors.Config{
		AllowOrigins:     allowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization", "X-Requested-With", "Accept", "Accept-Encoding", "Accept-Language", "Connection", "Upgrade", "Sec-WebSocket-Key", "Sec-WebSocket-Version", "Sec-WebSocket-Protocol"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           86400,
	}

	return config
}

// GetWebSocketAllowedOrigins returns allowed origins for WebSocket connections
func GetWebSocketAllowedOrigins() []string {
	env := os.Getenv("GIN_MODE")

	if env == "release" {
		// Production origins
		return getEnvSlice("WEBSOCKET_ALLOWED_ORIGINS", []string{
			"*", // Allow all origins
		})
	}

	// Development origins
	return getEnvSlice("WEBSOCKET_ALLOWED_ORIGINS", []string{
		"*", // Allow all origins
	})
}

// IsWebSocketOriginAllowed checks if an origin is allowed for WebSocket connections
func IsWebSocketOriginAllowed(origin string) bool {
	allowedOrigins := GetWebSocketAllowedOrigins()

	for _, allowedOrigin := range allowedOrigins {
		if origin == allowedOrigin {
			return true
		}
	}

	// In development mode, allow all origins for easier testing
	env := os.Getenv("GIN_MODE")
	if env != "release" {
		return true
	}

	return false
}

// Helper function to get environment variable as slice
func getEnvSlice(key string, defaultValue []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	parts := strings.Split(value, ",")
	result := make([]string, len(parts))
	for i, part := range parts {
		result[i] = strings.TrimSpace(part)
	}

	return result
}

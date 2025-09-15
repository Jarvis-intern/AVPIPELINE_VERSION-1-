package sockets

// WebSocketIntegration provides websocket functionality for conversion service
type WebSocketIntegration struct {
	hub *Manager
}

// NewWebSocketIntegration creates a new websocket integration
func NewWebSocketIntegration() *WebSocketIntegration {
	return &WebSocketIntegration{
		hub: &Hub,
	}
}

// EmitToUser sends an event to a specific user via websocket
func (w *WebSocketIntegration) EmitToUser(userID, event string, data map[string]any) {
	w.hub.EmitToUser(userID, event, data)
}

// EmitToAll broadcasts an event to all connected users
func (w *WebSocketIntegration) EmitToAll(event string, data map[string]any) {
	w.hub.EmitToAll(event, data)
}

// Global websocket integration instance
var globalWebSocketIntegration *WebSocketIntegration

// GetWebSocketIntegration returns the global websocket integration instance
func GetWebSocketIntegration() *WebSocketIntegration {
	if globalWebSocketIntegration == nil {
		globalWebSocketIntegration = NewWebSocketIntegration()
	}
	return globalWebSocketIntegration
}

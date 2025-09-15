package sockets

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	ID     string
	UserID string // Add user ID for targeted messaging
	Conn   *websocket.Conn
	Send   chan []byte
}

// WebSocketMessage represents the structure of websocket messages
type WebSocketMessage struct {
	Event  string         `json:"event"`
	Data   map[string]any `json:"data"`
	TaskID string         `json:"task_id,omitempty"`
	UserID string         `json:"user_id,omitempty"`
}

type Manager struct {
	Clients       map[string]*Client
	UserClients   map[string]*Client // Map user ID to client for targeted messaging
	Register      chan *Client
	Unregister    chan *Client
	Broadcast     chan []byte
	TargetMessage chan TargetedMessage
	mu            sync.Mutex
}

type TargetedMessage struct {
	UserID  string
	Message []byte
}

var Hub = Manager{
	Clients:       make(map[string]*Client),
	UserClients:   make(map[string]*Client),
	Register:      make(chan *Client),
	Unregister:    make(chan *Client),
	Broadcast:     make(chan []byte),
	TargetMessage: make(chan TargetedMessage),
}

func (m *Manager) Start() {
	for {
		select {
		case client := <-m.Register:
			m.mu.Lock()
			m.Clients[client.ID] = client
			if client.UserID != "" {
				m.UserClients[client.UserID] = client
			}
			m.mu.Unlock()

		case client := <-m.Unregister:
			m.mu.Lock()
			if _, ok := m.Clients[client.ID]; ok {
				delete(m.Clients, client.ID)
				if client.UserID != "" {
					delete(m.UserClients, client.UserID)
				}
				close(client.Send)
			}
			m.mu.Unlock()

		case message := <-m.Broadcast:
			m.mu.Lock()
			for _, client := range m.Clients {
				select {
				case client.Send <- message:
				default:
					log.Printf("Error: Client channel full, closing connection: %s", client.ID)
					close(client.Send)
					delete(m.Clients, client.ID)
					if client.UserID != "" {
						delete(m.UserClients, client.UserID)
					}
				}
			}
			m.mu.Unlock()

		case targetMsg := <-m.TargetMessage:
			m.mu.Lock()

			if client, ok := m.UserClients[targetMsg.UserID]; ok {
				select {
				case client.Send <- targetMsg.Message:
				default:
					log.Printf("Error: Client channel full for user %s, closing connection: %s", targetMsg.UserID, client.ID)
					close(client.Send)
					delete(m.Clients, client.ID)
					delete(m.UserClients, client.UserID)
				}
			} else {
				log.Printf("Error: No client found for user ID: %s", targetMsg.UserID)
			}
			m.mu.Unlock()
		}
	}
}

// EmitToUser sends a message to a specific user
func (m *Manager) EmitToUser(userID, event string, data map[string]any) {
	message := WebSocketMessage{
		Event:  event,
		Data:   data,
		UserID: userID,
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error: Failed to marshal websocket message: %v", err)
		return
	}

	m.TargetMessage <- TargetedMessage{
		UserID:  userID,
		Message: messageBytes,
	}
}

// EmitToAll broadcasts a message to all connected clients
func (m *Manager) EmitToAll(event string, data map[string]any) {
	message := WebSocketMessage{
		Event: event,
		Data:  data,
	}

	messageBytes, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error: Failed to marshal broadcast message: %v", err)
		return
	}

	m.Broadcast <- messageBytes
}

// sendError sends an error message to the client
func EmitError(client *Client, errorMsg string, event_type string) {
	errorResponse := WebSocketMessage{
		Event: event_type,
		Data: map[string]any{
			"error": errorMsg,
		},
	}

	if msgBytes, err := json.Marshal(errorResponse); err == nil {
		client.Send <- msgBytes
	}
}

// EmitToUser is a convenience function to emit events to a specific user
func EmitToUser(userID, event string, data map[string]any) {
	Hub.EmitToUser(userID, event, data)
}

// EmitToAll is a convenience function to broadcast events to all users
func EmitToAll(event string, data map[string]any) {
	Hub.EmitToAll(event, data)
}

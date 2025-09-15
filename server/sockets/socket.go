package sockets

import (
	"sync"

	"github.com/gorilla/websocket"
)

var (
	clients     = make(map[string]*websocket.Conn)
	clientsMux  sync.RWMutex
	handlers    = make(map[string][]func(map[string]interface{}))
	handlersMux sync.RWMutex
)

// On registers an event handler
func On(event string, handler func(map[string]interface{})) {
	handlersMux.Lock()
	defer handlersMux.Unlock()

	handlers[event] = append(handlers[event], handler)
}

// Off removes an event handler
func Off(event string, handler func(map[string]interface{})) {
	handlersMux.Lock()
	defer handlersMux.Unlock()

	if handlers[event] != nil {
		for i, h := range handlers[event] {
			if &h == &handler {
				handlers[event] = append(handlers[event][:i], handlers[event][i+1:]...)
				break
			}
		}
	}
}

// HandleEvent processes an incoming event
func HandleEvent(userID string, event string, data map[string]interface{}) {
	handlersMux.RLock()
	defer handlersMux.RUnlock()

	if handlers[event] != nil {
		for _, handler := range handlers[event] {
			handler(data)
		}
	}
}

// AddClient adds a new client connection
func AddClient(userID string, conn *websocket.Conn) {
	clientsMux.Lock()
	defer clientsMux.Unlock()
	clients[userID] = conn
}

// RemoveClient removes a client connection
func RemoveClient(userID string) {
	clientsMux.Lock()
	defer clientsMux.Unlock()
	delete(clients, userID)
}

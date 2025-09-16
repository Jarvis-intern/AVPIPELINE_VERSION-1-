package sockets

import (
    "encoding/json"
    "log"
)

// Broadcast sends an event with payload to all connected clients.
// Any struct/slice/map is marshaled to map[string]any and emitted with EmitToAll.
func Broadcast(event string, payload interface{}) {
    // Fast path if already correct type
    if data, ok := payload.(map[string]any); ok {
        EmitToAll(event, data)
        return
    }
    b, err := json.Marshal(payload)
    if err != nil {
        log.Printf("sockets.Broadcast marshal failed (%s): %v", event, err)
        return
    }
    var data map[string]any
    if err := json.Unmarshal(b, &data); err != nil {
        log.Printf("sockets.Broadcast unmarshal failed (%s): %v", event, err)
        return
    }
    EmitToAll(event, data)
}
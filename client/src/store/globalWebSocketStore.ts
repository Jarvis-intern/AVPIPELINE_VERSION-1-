import { create } from "zustand";
import ws from "@/lib/socket";

interface WebSocketStoreState {
  isConnected: boolean;
  connectionState: string;
  connect: (userID?: string) => void;
  disconnect: () => void;
  send: (event: string, data: any) => void;
  subscribeToEvent: (
    event: string,
    callback: (data: any) => void
  ) => () => void;
}

export const useWebSocketStore = create<WebSocketStoreState>((set) => {
  // Keep track of listeners to clean up if needed
  const eventListeners: { [event: string]: ((data: any) => void)[] } = {};

  // Internal handler to update connection state
  const updateConnectionState = () => {
    set({
      isConnected: ws.isConnected(),
      connectionState: ws.getConnectionState(),
    });
  };

  // Attach connection state listeners once
  ws.on("connect", updateConnectionState);
  ws.on("disconnect", updateConnectionState);
  ws.on("error", updateConnectionState);

  return {
    isConnected: ws.isConnected(),
    connectionState: ws.getConnectionState(),
    connect: (userID?: string) => {
      ws.connect(userID);
      updateConnectionState();
    },
    disconnect: () => {
      ws.disconnect();
      updateConnectionState();
    },
    send: (event, data) => {
      ws.emit(event, data);
    },
    subscribeToEvent: (event, callback) => {
      ws.on(event, callback);
      // Track for cleanup if needed
      if (!eventListeners[event]) eventListeners[event] = [];
      eventListeners[event].push(callback);
      // Return unsubscribe function
      return () => {
        ws.off(event, callback);
        eventListeners[event] = eventListeners[event].filter(
          (cb) => cb !== callback
        );
      };
    },
  };
});

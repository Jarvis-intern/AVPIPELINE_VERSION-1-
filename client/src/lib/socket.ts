import { SOCKET_URL } from "@/constants/api";

interface WebSocketMessage {
  event: string;
  data: any;
  task_id?: string;
  user_id?: string;
}

class WebSocketClient {
  private socket?: WebSocket;
  private listeners: { [event: string]: ((data: any) => void)[] } = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private userID?: string;
  private isConnecting = false;

  connect(userID?: string) {
    if (
      this.isConnecting ||
      (this.socket && this.socket.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    this.isConnecting = true;
    this.userID = userID;

    // Build WebSocket URL with user_id parameter if available
    let wsUrl = SOCKET_URL || "ws://localhost:8000/ws";
    if (userID) {
      wsUrl += `?user_id=${encodeURIComponent(userID)}`;
    }

    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.emitEvent("connect", {});
    };

    this.socket.onclose = (event) => {
      this.isConnecting = false;
      this.emitEvent("disconnect", { code: event.code, reason: event.reason });

      // Attempt to reconnect if not a normal closure
      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.maxReconnectAttempts
      ) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = (err) => {
      console.error("WebSocket error:", err);
      this.isConnecting = false;
      this.emitEvent("error", err);
    };

    this.socket.onmessage = (message) => {
      try {
        const parsed: WebSocketMessage = JSON.parse(message.data);
        this.emitEvent(parsed.event, parsed.data);
      } catch (e) {
        console.error("WebSocket message parsing error:", e);
      }
    };
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) {
        this.connect(this.userID);
      }
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close(1000, "Client disconnect");
      this.socket = undefined;
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event: string, callback?: (data: any) => void) {
    if (!callback) {
      delete this.listeners[event];
    } else {
      const listeners = this.listeners[event];
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        event,
        data,
        user_id: this.userID,
      };

      this.socket.send(JSON.stringify(message));
    } else {
      console.warn(
        "WebSocket is not open. Current state:",
        this.socket?.readyState
      );
    }
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.socket) return "disconnected";

    switch (this.socket.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
        return "closing";
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "unknown";
    }
  }

  private emitEvent(event: string, data: any) {
    this.listeners[event]?.forEach((cb) => cb(data));
  }
}

const ws = new WebSocketClient();
export default ws;

import type { WSMessage } from "../types";

type WSHandler = (message: WSMessage) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private handlers: Map<string, Set<WSHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;
  private wsUrl: string;
  private sseUrl: string;
  private _connected = false;
  private _useSSE = false;

  constructor() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;
    this.sseUrl = `${window.location.origin}/api/stream`;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this._useSSE) {
      this.connectSSE();
      return;
    }
    this.connectWS();
  }

  private connectWS() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log("[WS] Connected");
      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      this._connected = true;
      this.connectionHandlers.forEach((h) => h(true));
    };

    this.ws.onmessage = (event) => {
      let parsed;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return; // Ignore malformed messages
      }
      // Support batch messages (JSON array) for efficiency
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      for (const message of messages) {
        // Respond to server pings to keep connection alive
        if (message.event === "ping") {
          this.ws?.send(JSON.stringify({ event: "pong", data: {}, timestamp: new Date().toISOString() }));
          continue;
        }
        this.dispatchMessage(message);
      }
    };

    this.ws.onclose = (event) => {
      this._connected = false;
      this.connectionHandlers.forEach((h) => h(false));

      // If WebSocket was rejected with 403, switch to SSE permanently
      if (event.code === 1006 && this.reconnectAttempts >= 2) {
        console.log("[WS] WebSocket blocked, switching to SSE fallback");
        this._useSSE = true;
        this.connectSSE();
        return;
      }

      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempts),
        this.maxReconnectDelay
      );
      this.reconnectAttempts++;
      console.log(`[WS] Disconnected, reconnecting in ${delay / 1000}s...`);
      this.reconnectTimeout = setTimeout(() => this.connect(), delay);
    };

    this.ws.onerror = () => {
      // Error logged by onclose
    };
  }

  private connectSSE() {
    if (this.sse) {
      this.sse.close();
    }

    console.log("[SSE] Connecting...");
    this.sse = new EventSource(this.sseUrl);

    this.sse.onopen = () => {
      console.log("[SSE] Connected");
      this.reconnectAttempts = 0;
      this._connected = true;
      this.connectionHandlers.forEach((h) => h(true));
    };

    this.sse.onmessage = (event) => {
      try {
        this.dispatchMessage(JSON.parse(event.data));
      } catch {
        // keepalive comment, ignore
      }
    };

    this.sse.onerror = () => {
      this._connected = false;
      this.connectionHandlers.forEach((h) => h(false));
      // EventSource auto-reconnects
    };
  }

  private dispatchMessage(message: WSMessage) {
    const handlers = this.handlers.get(message.event);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }
    const wildcardHandlers = this.handlers.get("*");
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws?.close();
    this.ws = null;
    this.sse?.close();
    this.sse = null;
    this._connected = false;
    this.connectionHandlers.forEach((h) => h(false));
  }

  on(event: string, handler: WSHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: WSHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    handler(this._connected);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  send(event: string, data: unknown) {
    // WebSocket: send directly
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
      return;
    }
    // SSE fallback: use HTTP POST for client-to-server messages
    fetch("/api/ws-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    }).catch(() => {});
  }
}

export const wsService = new WebSocketService();

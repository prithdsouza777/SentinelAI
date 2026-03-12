import { useEffect, useRef } from "react";
import { wsService } from "../services/websocket";
import type { WSMessage } from "../types";

export function useWebSocket(
  event: string,
  handler: (message: WSMessage) => void
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (message: WSMessage) => savedHandler.current(message);
    const unsubscribe = wsService.on(event, listener);
    return unsubscribe;
  }, [event]);
}

export function useWebSocketConnection() {
  useEffect(() => {
    wsService.connect();
    return () => wsService.disconnect();
  }, []);
}

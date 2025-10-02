import { wsConfig } from '@/lib/env';

// WebSocket客户端配置（客户端安全）
const clientWsConfig = {
  port: wsConfig.clientPort,
};

export interface WsMessage<T = unknown> {
  channel: string;
  data: T;
  ts: number;
}

export interface WsClient {
  connect(): void;
  disconnect(): void;
  subscribe(channel: string): void;
  unsubscribe(channel: string): void;
  onMessage<T>(callback: (message: WsMessage<T>) => void): void;
  isConnected(): boolean;
}

export function createWsClient(): WsClient {
  let ws: WebSocket | null = null;
  let messageCallback: ((message: WsMessage) => void) | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 1000;

  function connect() {
    if (ws?.readyState === WebSocket.OPEN) {return;}

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = clientWsConfig.port;
      ws = new WebSocket(`${protocol}//${host}:${port}`);

      ws.onopen = () => {
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as WsMessage;
          messageCallback?.(message);
        } catch {
          // 忽略格式错误的消息
        }
      };

      ws.onclose = () => {
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimer = setTimeout(
            () => {
              reconnectAttempts++;
              connect();
            },
            reconnectDelay * Math.pow(2, reconnectAttempts)
          );
        }
      };

      ws.onerror = () => {
        // 连接错误，将触发onclose事件
      };
    } catch {
      // Connection failed
    }
  }

  function disconnect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    reconnectAttempts = maxReconnectAttempts; // Prevent reconnection
    ws?.close();
    ws = null;
  }

  function subscribe(channel: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }

  function unsubscribe(channel: string) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }

  function onMessage<T>(callback: (message: WsMessage<T>) => void) {
    messageCallback = callback as (message: WsMessage) => void;
  }

  function isConnected(): boolean {
    return ws?.readyState === WebSocket.OPEN;
  }

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    onMessage,
    isConnected,
  };
}

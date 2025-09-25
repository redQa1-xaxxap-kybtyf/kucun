import { useEffect, useRef, useState } from 'react';

import {
  createWsClient,
  type WsClient,
  type WsMessage,
} from '@/lib/ws/ws-client';

export interface UseWebSocketOptions {
  channels?: string[];
  onMessage?: (message: WsMessage) => void;
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { channels = [], onMessage, autoConnect = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<WsClient | null>(null);
  const subscribedChannelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!clientRef.current) {
      clientRef.current = createWsClient();
    }

    const client = clientRef.current;

    client.onMessage(message => {
      onMessage?.(message);
    });

    if (autoConnect) {
      client.connect();
    }

    // Check connection status periodically
    const statusInterval = setInterval(() => {
      setIsConnected(client.isConnected());
    }, 1000);

    return () => {
      clearInterval(statusInterval);
      client.disconnect();
    };
  }, [onMessage, autoConnect]);

  useEffect(() => {
    if (!clientRef.current) return;

    const client = clientRef.current;

    // Subscribe to new channels
    channels.forEach(channel => {
      if (!subscribedChannelsRef.current.has(channel)) {
        client.subscribe(channel);
        subscribedChannelsRef.current.add(channel);
      }
    });

    // Unsubscribe from removed channels
    subscribedChannelsRef.current.forEach(channel => {
      if (!channels.includes(channel)) {
        client.unsubscribe(channel);
        subscribedChannelsRef.current.delete(channel);
      }
    });
  }, [channels]);

  const subscribe = (channel: string) => {
    if (clientRef.current && !subscribedChannelsRef.current.has(channel)) {
      clientRef.current.subscribe(channel);
      subscribedChannelsRef.current.add(channel);
    }
  };

  const unsubscribe = (channel: string) => {
    if (clientRef.current && subscribedChannelsRef.current.has(channel)) {
      clientRef.current.unsubscribe(channel);
      subscribedChannelsRef.current.delete(channel);
    }
  };

  const connect = () => {
    clientRef.current?.connect();
  };

  const disconnect = () => {
    clientRef.current?.disconnect();
  };

  return {
    isConnected,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}

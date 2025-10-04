import { useEffect, useRef, useState, useCallback } from 'react';

import {
  createWsClient,
  type WsClient,
  type WsMessage,
} from '@/lib/ws/ws-client';
import type { BusinessEvent } from '@/lib/events/types';
import { EventChannels } from '@/lib/events/types';

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
    if (!clientRef.current) {
      return;
    }

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

/**
 * Subscribe to user notifications
 */
export function useUserNotifications(
  userId: string,
  onNotification: (
    notification: BusinessEvent & { type: 'notification' }
  ) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.userNotification(userId)) {
        onNotification(
          message.data as BusinessEvent & { type: 'notification' }
        );
      }
    },
    [userId, onNotification]
  );

  return useWebSocket({
    channels: [EventChannels.userNotification(userId)],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to inventory changes
 */
export function useInventoryUpdates(
  onUpdate: (event: BusinessEvent & { type: 'inventory:change' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.inventory) {
        onUpdate(message.data as BusinessEvent & { type: 'inventory:change' });
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.inventory],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to order status changes
 */
export function useOrderUpdates(
  onUpdate: (event: BusinessEvent & { type: 'order:status' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.orders) {
        onUpdate(message.data as BusinessEvent & { type: 'order:status' });
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.orders],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to approval events
 */
export function useApprovalUpdates(
  onUpdate: (
    event: BusinessEvent & {
      type: 'approval:request' | 'approval:approved' | 'approval:rejected';
    }
  ) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.approvals) {
        onUpdate(
          message.data as BusinessEvent & {
            type:
              | 'approval:request'
              | 'approval:approved'
              | 'approval:rejected';
          }
        );
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.approvals],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to finance events
 */
export function useFinanceUpdates(
  onUpdate: (
    event: BusinessEvent & {
      type: 'finance:payment' | 'finance:refund' | 'finance:overdue';
    }
  ) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.finance) {
        onUpdate(
          message.data as BusinessEvent & {
            type: 'finance:payment' | 'finance:refund' | 'finance:overdue';
          }
        );
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.finance],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to product data changes
 */
export function useProductUpdates(
  onUpdate: (event: BusinessEvent & { type: 'data:change' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.products) {
        onUpdate(message.data as BusinessEvent & { type: 'data:change' });
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.products],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to customer data changes
 */
export function useCustomerUpdates(
  onUpdate: (event: BusinessEvent & { type: 'data:change' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.customers) {
        onUpdate(message.data as BusinessEvent & { type: 'data:change' });
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.customers],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to supplier data changes
 */
export function useSupplierUpdates(
  onUpdate: (event: BusinessEvent & { type: 'data:change' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.suppliers) {
        onUpdate(message.data as BusinessEvent & { type: 'data:change' });
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.suppliers],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to system events
 */
export function useSystemUpdates(
  onUpdate: (
    event: BusinessEvent & {
      type: 'system:maintenance' | 'system:update' | 'system:alert';
    }
  ) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.system) {
        onUpdate(
          message.data as BusinessEvent & {
            type: 'system:maintenance' | 'system:update' | 'system:alert';
          }
        );
      }
    },
    [onUpdate]
  );

  return useWebSocket({
    channels: [EventChannels.system],
    onMessage: handleMessage,
  });
}

/**
 * Subscribe to broadcast messages
 */
export function useBroadcast(
  onMessage: (event: BusinessEvent & { type: 'system:alert' }) => void
): UseWebSocketReturn {
  const handleMessage = useCallback(
    (message: WsMessage) => {
      if (message.channel === EventChannels.broadcast) {
        onMessage(message.data as BusinessEvent & { type: 'system:alert' });
      }
    },
    [onMessage]
  );

  return useWebSocket({
    channels: [EventChannels.broadcast],
    onMessage: handleMessage,
  });
}

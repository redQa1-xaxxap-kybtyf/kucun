'use client';

import { useQueryClient } from '@tanstack/react-query';
import React, { createContext, useContext, useEffect } from 'react';

import { useWebSocket, type UseWebSocketReturn } from '@/hooks/use-websocket';
import { inventoryQueryKeys } from '@/lib/api/inventory';
import { productQueryKeys } from '@/lib/api/products';

type WebSocketContextType = UseWebSocketReturn;

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const queryClient = useQueryClient();

  const wsClient = useWebSocket({
    channels: ['products', 'inventory'],
    onMessage: message => {
      // Handle real-time updates with optimistic updates
      switch (message.channel) {
        case 'products': {
          // Use optimistic updates for specific product changes
          if (message.data?.productId) {
            queryClient.setQueryData(
              productQueryKeys.byId(message.data.productId),
              (oldProduct: unknown) => {
                if (!oldProduct) {
                  return oldProduct;
                }
                return {
                  ...oldProduct,
                  ...message.data,
                  updatedAt: new Date(),
                };
              }
            );
          } else {
            // Only invalidate if we don't have specific product ID
            queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
          }
          break;
        }
        case 'inventory': {
          // Use optimistic updates for specific inventory changes
          if (message.data?.productId) {
            queryClient.setQueryData(
              inventoryQueryKeys.byProduct(message.data.productId),
              (oldInventory: unknown) => {
                if (!oldInventory) {
                  return oldInventory;
                }
                return {
                  ...oldInventory,
                  ...message.data,
                  updatedAt: new Date(),
                };
              }
            );
          } else {
            // Only invalidate if we don't have specific product ID
            queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.all });
          }
          break;
        }
        default:
          break;
      }
    },
    autoConnect: true,
  });

  // Ensure WebSocket server is started
  useEffect(() => {
    fetch('/api/ws').catch(() => {
      // Ignore errors - server might already be running
    });
  }, []);

  return (
    <WebSocketContext.Provider value={wsClient}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      'useWebSocketContext must be used within a WebSocketProvider'
    );
  }
  return context;
}

'use client';

import {
  type DependencyList,
  type MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

interface WebSocketConnectionState {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

type HandlerRef<TEvent> = MutableRefObject<
  ((event: TEvent) => void) | undefined
>;

function useHandlerRef<TEvent>(
  handler?: (event: TEvent) => void
): HandlerRef<TEvent> {
  const handlerRef = useRef<typeof handler>(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  return handlerRef;
}

function useStubbedChannel<TEvent>(
  handler?: (event: TEvent) => void,
  deps: DependencyList = []
): WebSocketConnectionState {
  const [isConnected, setIsConnected] = useState(false);
  const handlerRef = useHandlerRef(handler);

  useEffect(() => {
    setIsConnected(true);
    return () => {
      setIsConnected(false);
    };
  }, deps);

  useEffect(() => {
    if (!handlerRef.current) {
      return;
    }

    // 在真实实现中，这里会订阅 WebSocket 事件。
    // 目前仅保留引用以保持 API 兼容性。
    return () => {
      // 清理订阅
    };
  }, [handlerRef]);

  const connect = useCallback(() => {
    setIsConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    setIsConnected(false);
  }, []);

  return { isConnected, connect, disconnect };
}

// === 事件类型定义 ===

export interface UserNotificationEvent {
  id: string;
  title: string;
  message: string;
  notificationType: 'success' | 'info' | 'warning' | 'error';
  actionUrl?: string;
  createdAt?: string;
}

export interface InventoryUpdateEvent {
  productId: string;
  productName: string;
  action: 'inbound' | 'outbound' | 'adjustment';
  oldQuantity: number;
  newQuantity: number;
  changeAmount: number;
  updatedAt?: string;
}

export interface OrderStatusEvent {
  orderId: string;
  orderNumber: string;
  oldStatus: string;
  newStatus: string;
  changedAt?: string;
}

export interface ApprovalWorkflowEvent {
  type: 'approval:request' | 'approval:approved' | 'approval:rejected';
  resourceId: string;
  resourceNumber: string;
  comment?: string;
  requestedBy?: string;
  processedBy?: string;
}

export interface FinanceEvent {
  type: 'finance:payment' | 'finance:refund' | 'finance:overdue';
  recordId: string;
  recordNumber: string;
  action?: 'created' | 'confirmed' | 'cancelled';
  amount?: number;
  occurredAt?: string;
}

export interface ProductChangeEvent {
  action: 'created' | 'updated' | 'deleted';
  resourceId: string;
  resourceName: string;
  updatedFields?: string[];
}

export interface SystemAnnouncementEvent {
  type: 'system:maintenance' | 'system:alert';
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  scheduledTime?: string;
  estimatedDuration?: string;
}

export interface BroadcastEvent {
  message: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'critical';
  createdAt?: string;
}

// === Hook 导出 ===

export function useUserNotifications(
  userId: string,
  handler: (event: UserNotificationEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler, [userId]);
}

export function useInventoryUpdates(
  handler: (event: InventoryUpdateEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useOrderUpdates(
  handler: (event: OrderStatusEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useApprovalUpdates(
  handler: (event: ApprovalWorkflowEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useFinanceUpdates(
  handler: (event: FinanceEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useProductUpdates(
  handler: (event: ProductChangeEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useSystemUpdates(
  handler: (event: SystemAnnouncementEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

export function useBroadcast(
  handler: (event: BroadcastEvent) => void
): WebSocketConnectionState {
  return useStubbedChannel(handler);
}

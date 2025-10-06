'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { BusinessEvent } from '@/lib/events/types';
import { queryKeys } from '@/lib/queryKeys';
import type { NotificationItem } from '@/lib/types/layout';
import type { WsMessage } from '@/lib/ws/ws-client';
import { useUserNotifications, useWebSocket } from './use-websocket';

/**
 * 实时通知 Hook
 * 使用 WebSocket 替代轮询，实现低延迟的通知推送
 */
export function useRealtimeNotifications() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isSubscribedRef = useRef(false);

  // 处理用户专属通知
  const handleUserNotification = useCallback(
    (event: BusinessEvent & { type: 'notification' }) => {
      const notification: NotificationItem = {
        id: `${event.timestamp}-${Math.random()}`,
        title: event.title,
        message: event.message,
        type: event.notificationType,
        isRead: false,
        createdAt: new Date(event.timestamp),
        href: event.actionUrl,
        onClick: event.actionUrl
          ? () => window.location.assign(event.actionUrl!)
          : undefined,
      };

      // 添加到通知列表
      setNotifications(prev => [notification, ...prev].slice(0, 50)); // 最多保留50条
      setUnreadCount(prev => prev + 1);

      // 显示浏览器通知（如果用户授权）
      if (Notification.permission === 'granted') {
        try {
          new Notification(notification.title, {
            body: notification.message,
            icon: '/icon-192.png',
            tag: notification.id,
          });
        } catch (error) {
          console.error('Failed to create browser notification:', error);
        }
      }
    },
    []
  );

  // 订阅用户专属通知频道（防止重复订阅）
  const shouldSubscribe = !!session?.user?.id && !isSubscribedRef.current;
  const userNotificationWs = useUserNotifications(
    shouldSubscribe ? session.user.id : '',
    handleUserNotification
  );

  // 标记已订阅
  useEffect(() => {
    if (session?.user?.id) {
      isSubscribedRef.current = true;
    }
    return () => {
      isSubscribedRef.current = false;
    };
  }, [session?.user?.id]);

  // 处理库存变更事件
  const handleInventoryChange = useCallback(
    (message: WsMessage<BusinessEvent>) => {
      if (message.data.type === 'inventory:change') {
        const event = message.data;
        const notification: NotificationItem = {
          id: `inv-${event.timestamp}`,
          title: '库存变更',
          message: `产品 ${event.productName || event.productId} 库存从 ${event.oldQuantity} 变更为 ${event.newQuantity}`,
          type: 'info',
          isRead: false,
          createdAt: new Date(event.timestamp),
          href: '/inventory',
        };

        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);

        // 使用乐观更新而非失效整类缓存
        // 更新特定产品的库存数据
        if (event.productId) {
          queryClient.setQueryData(
            queryKeys.inventory.byProduct(event.productId),
            (oldData: any) => {
              if (!oldData) return oldData;
              return {
                ...oldData,
                quantity: event.newQuantity,
                updatedAt: new Date(event.timestamp),
              };
            }
          );
        }

        // 更新仪表盘统计数据（如果有相关数据）
        queryClient.setQueryData(queryKeys.dashboard.stats, (oldStats: any) => {
          if (!oldStats) return oldStats;
          // 更新库存相关统计
          return {
            ...oldStats,
            lastUpdated: new Date(event.timestamp),
          };
        });
      }
    },
    [queryClient]
  );

  // 处理订单状态变更
  const handleOrderStatus = useCallback(
    (message: WsMessage<BusinessEvent>) => {
      if (message.data.type === 'order:status') {
        const event = message.data;
        const notification: NotificationItem = {
          id: `order-${event.timestamp}`,
          title: '订单状态更新',
          message: `订单 ${event.orderNumber} 状态从 "${event.oldStatus}" 变更为 "${event.newStatus}"`,
          type: 'info',
          isRead: false,
          createdAt: new Date(event.timestamp),
          href:
            event.orderType === 'sales'
              ? `/sales-orders/${event.orderId}`
              : `/return-orders/${event.orderId}`,
        };

        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);

        // 使用乐观更新特定订单数据
        if (event.orderId) {
          queryClient.setQueryData(
            queryKeys.salesOrders.byId(event.orderId),
            (oldOrder: any) => {
              if (!oldOrder) return oldOrder;
              return {
                ...oldOrder,
                status: event.newStatus,
                updatedAt: new Date(event.timestamp),
              };
            }
          );

          // 更新订单列表中的特定项
          queryClient.setQueryData(
            queryKeys.salesOrders.list(),
            (oldList: any) => {
              if (!oldList?.orders) return oldList;
              return {
                ...oldList,
                orders: oldList.orders.map((order: any) =>
                  order.id === event.orderId
                    ? {
                        ...order,
                        status: event.newStatus,
                        updatedAt: new Date(event.timestamp),
                      }
                    : order
                ),
              };
            }
          );
        }
      }
    },
    [queryClient]
  );

  // 处理审核事件
  const handleApproval = useCallback((message: WsMessage<BusinessEvent>) => {
    if (
      message.data.type === 'approval:request' ||
      message.data.type === 'approval:approved' ||
      message.data.type === 'approval:rejected'
    ) {
      const event = message.data;
      let title = '审核通知';
      let type: NotificationItem['type'] = 'info';

      if (event.type === 'approval:request') {
        title = '待审核';
        type = 'warning';
      } else if (event.type === 'approval:approved') {
        title = '审核通过';
        type = 'success';
      } else {
        title = '审核拒绝';
        type = 'error';
      }

      const notification: NotificationItem = {
        id: `approval-${event.timestamp}`,
        title,
        message: `${event.resourceType} ${event.resourceNumber} ${event.type === 'approval:request' ? '需要审核' : event.type === 'approval:approved' ? '已批准' : '已拒绝'}`,
        type,
        isRead: false,
        createdAt: new Date(event.timestamp),
        href: `/${event.resourceType}s/${event.resourceId}`,
      };

      setNotifications(prev => [notification, ...prev].slice(0, 50));
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  // 处理财务事件
  const handleFinance = useCallback(
    (message: WsMessage<BusinessEvent>) => {
      if (
        message.data.type === 'finance:payment' ||
        message.data.type === 'finance:refund' ||
        message.data.type === 'finance:overdue'
      ) {
        const event = message.data;
        const notification: NotificationItem = {
          id: `finance-${event.timestamp}`,
          title:
            event.type === 'finance:overdue'
              ? '逾期提醒'
              : event.type === 'finance:refund'
                ? '退款通知'
                : '收付款通知',
          message: `${event.recordType === 'payment' ? '收款' : event.recordType === 'paymentOut' ? '付款' : '退款'} ${event.recordNumber} 金额 ¥${event.amount}`,
          type: event.type === 'finance:overdue' ? 'error' : 'info',
          isRead: false,
          createdAt: new Date(event.timestamp),
          href: '/finance',
        };

        setNotifications(prev => [notification, ...prev].slice(0, 50));
        setUnreadCount(prev => prev + 1);

        // 使用乐观更新财务数据
        if (event.recordId) {
          queryClient.setQueryData(
            queryKeys.finance.byId(event.recordId),
            (oldRecord: any) => {
              if (!oldRecord) return oldRecord;
              return {
                ...oldRecord,
                amount: event.amount,
                updatedAt: new Date(event.timestamp),
              };
            }
          );
        }

        // 更新财务统计数据
        queryClient.setQueryData(queryKeys.finance.stats, (oldStats: any) => {
          if (!oldStats) return oldStats;
          return {
            ...oldStats,
            lastUpdated: new Date(event.timestamp),
          };
        });
      }
    },
    [queryClient]
  );

  // 订阅业务频道
  const businessWs = useWebSocket({
    channels: ['inventory', 'orders', 'approvals', 'finance'],
    onMessage: message => {
      // 类型断言：业务频道的消息总是 BusinessEvent 类型
      const typedMessage = message as WsMessage<BusinessEvent>;
      switch (typedMessage.channel) {
        case 'inventory':
          handleInventoryChange(typedMessage);
          break;
        case 'orders':
          handleOrderStatus(typedMessage);
          break;
        case 'approvals':
          handleApproval(typedMessage);
          break;
        case 'finance':
          handleFinance(typedMessage);
          break;
      }
    },
    autoConnect: !!session?.user?.id,
  });

  // 标记通知为已读
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, isRead: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  // 标记所有通知为已读
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  // 清除通知
  const clearNotification = useCallback(
    (notificationId: string) => {
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.isRead ? prev - 1 : prev;
      });
    },
    [notifications]
  );

  // 清除所有通知
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // 请求浏览器通知权限
  useEffect(() => {
    if (
      session?.user?.id &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission();
    }
  }, [session?.user?.id]);

  // 初始加载：从 API 获取历史通知
  useEffect(() => {
    if (session?.user?.id) {
      const controller = new AbortController();

      fetch('/api/notifications', { signal: controller.signal })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNotifications(data.notifications || []);
            setUnreadCount(
              data.notifications?.filter((n: NotificationItem) => !n.isRead)
                .length || 0
            );
          }
        })
        .catch(error => {
          // 忽略 AbortError，这是正常的取消操作
          if (error.name !== 'AbortError') {
            console.error('Failed to fetch notifications:', error);
          }
        });

      return () => {
        controller.abort();
      };
    }
  }, [session?.user?.id]);

  return {
    notifications,
    unreadCount,
    isConnected: userNotificationWs.isConnected || businessWs.isConnected,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  };
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { queryKeys } from '@/lib/queryKeys';
import type { NotificationItem } from '@/lib/types/layout';

/**
 * 通知轮询 Hook
 * 使用轮询替代 WebSocket，实现简单可靠的通知推送
 *
 * 优势：
 * - 更简单：无需维护 WebSocket 连接
 * - 更可靠：HTTP 请求更稳定
 * - 更易调试：标准的 API 请求
 * - 更省资源：无需额外端口和 Redis Pub/Sub
 *
 * 性能优化：
 * - 直接使用 TanStack Query 数据，避免本地状态同步
 * - 使用乐观更新提升用户体验
 * - 避免在渲染期间设置状态，消除双重渲染问题
 */
export function usePollingNotifications() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  // 轮询通知接口（每60秒）
  const {
    data: notificationsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>;
    },
    enabled: !!session?.user?.id,
    // 每60秒轮询一次
    refetchInterval: 60 * 1000,
    // 窗口聚焦时重新获取
    refetchOnWindowFocus: true,
    // 保持数据新鲜5分钟
    staleTime: 5 * 60 * 1000,
  });

  // 标记为已读 - 使用乐观更新
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        // 乐观更新：立即更新 UI
        queryClient.setQueryData<{
          notifications: NotificationItem[];
          unreadCount: number;
        }>(queryKeys.notifications.list(), old => {
          if (!old) {
            return old;
          }
          return {
            notifications: old.notifications.map(n =>
              n.id === notificationId ? { ...n, isRead: true } : n
            ),
            unreadCount: Math.max(0, old.unreadCount - 1),
          };
        });

        // 发送请求到服务器
        await fetch(`/api/notifications/${notificationId}/read`, {
          method: 'POST',
        });

        // 重新获取以确保数据一致性
        refetch();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        // 失败时回滚
        refetch();
      }
    },
    [queryClient, refetch]
  );

  // 全部标记为已读 - 使用乐观更新
  const markAllAsRead = useCallback(async () => {
    try {
      // 乐观更新：立即更新 UI
      queryClient.setQueryData<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>(queryKeys.notifications.list(), old => {
        if (!old) {
          return old;
        }
        return {
          notifications: old.notifications.map(n => ({ ...n, isRead: true })),
          unreadCount: 0,
        };
      });

      // 发送请求到服务器
      await fetch('/api/notifications/read-all', {
        method: 'POST',
      });

      // 重新获取以确保数据一致性
      refetch();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      // 失败时回滚
      refetch();
    }
  }, [queryClient, refetch]);

  // 清除通知 - 使用乐观更新
  const clearNotification = useCallback(
    async (notificationId: string) => {
      try {
        // 乐观更新：立即更新 UI
        queryClient.setQueryData<{
          notifications: NotificationItem[];
          unreadCount: number;
        }>(queryKeys.notifications.list(), old => {
          if (!old) {
            return old;
          }
          const notification = old.notifications.find(
            n => n.id === notificationId
          );
          return {
            notifications: old.notifications.filter(
              n => n.id !== notificationId
            ),
            unreadCount: notification?.isRead
              ? old.unreadCount
              : Math.max(0, old.unreadCount - 1),
          };
        });

        // 发送请求到服务器
        await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        });

        // 重新获取以确保数据一致性
        refetch();
      } catch (error) {
        console.error('Failed to clear notification:', error);
        // 失败时回滚
        refetch();
      }
    },
    [queryClient, refetch]
  );

  return {
    // 直接返回 TanStack Query 的数据，避免本地状态同步
    notifications: notificationsData?.notifications ?? [],
    unreadCount: notificationsData?.unreadCount ?? 0,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearNotification,
  };
}

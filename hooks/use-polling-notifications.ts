'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import React, { useCallback } from 'react';

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
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();

  // 🚀 性能优化：只有在完全认证且有 userId 时才启用
  const isFullyAuthenticated =
    status === 'authenticated' &&
    !!session?.user?.id &&
    session.user.id.length > 0;

  // 🚀 性能优化：使用 ref 追踪首次加载，避免热重载触发请求
  const hasInitializedRef = React.useRef(false);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    if (isFullyAuthenticated) {
      // 如果是首次认证成功，等待 300ms 确保 cookie 完全同步
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        const timer = setTimeout(() => setIsReady(true), 300);
        return () => clearTimeout(timer);
      } else {
        // 如果已经初始化过（页面刷新等情况），立即启用
        setIsReady(true);
      }
    } else {
      setIsReady(false);
      hasInitializedRef.current = false;
    }
  }, [isFullyAuthenticated]);

  // 轮询通知接口（每60秒）
  const {
    data: notificationsData,
    isLoading,
    refetch,
  } = useQuery({
    // 🚀 最佳实践：将 userId 包含在 queryKey 中，确保登录前后查询隔离
    queryKey: queryKeys.notifications.list(session?.user?.id),
    queryFn: async () => {
      // 🚀 双重检查：确保 session 仍然有效
      if (!session?.user?.id) {
        return { notifications: [], unreadCount: 0 };
      }

      const response = await fetch('/api/notifications');
      if (!response.ok) {
        // 🚀 性能优化：静默处理 401 错误，避免控制台警告
        if (response.status === 401) {
          return { notifications: [], unreadCount: 0 };
        }
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<{
        notifications: NotificationItem[];
        unreadCount: number;
      }>;
    },
    // 🚀 性能优化：使用 isReady 状态，确保 cookie 完全同步后再发起请求
    enabled: isReady,
    // 每60秒轮询一次
    refetchInterval: isReady ? 60 * 1000 : false,
    // 窗口聚焦时重新获取（仅在已认证时）
    refetchOnWindowFocus: isReady,
    // 保持数据新鲜5分钟
    staleTime: 5 * 60 * 1000,
    // 🚀 性能优化：失败时不重试，避免不必要的请求
    retry: false,
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

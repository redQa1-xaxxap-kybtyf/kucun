'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback, useMemo } from 'react';

import { queryKeys } from '@/lib/queryKeys';
import type { NotificationItem } from '@/lib/types/layout';
import type {
  NotificationsQueryData,
  RawNotificationItem,
} from '@/lib/types/notifications';
import { resolveAsyncState } from '@/lib/utils/async-state';
import { csrfFetch } from '@/lib/utils/csrf';

type NotificationsQueryKey = ReturnType<typeof queryKeys.notifications.list>;
type CacheUpdater = (
  old: NotificationsQueryData | undefined
) => NotificationsQueryData | undefined;
type AsyncOperation = () => Promise<void>;

const createNotificationNormalizer =
  () =>
  (notifications: RawNotificationItem[]): NotificationItem[] =>
    notifications.map(notification => ({
      ...notification,
      createdAt:
        notification.createdAt instanceof Date
          ? notification.createdAt
          : new Date(notification.createdAt),
        href: notification.href ?? undefined,
    }));

function createMarkAsReadUpdater(notificationId: string): CacheUpdater {
  return old => {
    if (!old) {
      return old;
    }

    return {
      notifications: old.notifications.map(n =>
        n.id === notificationId ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, old.unreadCount - 1),
    };
  };
}

function createMarkAllAsReadUpdater(): CacheUpdater {
  return old => {
    if (!old) {
      return old;
    }

    return {
      notifications: old.notifications.map(n => ({
        ...n,
        isRead: true,
      })),
      unreadCount: 0,
    };
  };
}

function createClearNotificationUpdater(notificationId: string): CacheUpdater {
  return old => {
    if (!old) {
      return old;
    }

    const notification = old.notifications.find(n => n.id === notificationId);
    return {
      notifications: old.notifications.filter(n => n.id !== notificationId),
      unreadCount: notification?.isRead
        ? old.unreadCount
        : Math.max(0, old.unreadCount - 1),
    };
  };
}

async function ensureMutationSuccess(
  response: Response,
  fallbackMessage: string
): Promise<void> {
  if (response.ok) {
    return;
  }

  let message = fallbackMessage;

  try {
    const payload = (await response.json()) as { error?: string };
    if (payload.error) {
      message = payload.error;
    }
  } catch {
    // 忽略解析失败，继续使用回退文案
  }

  throw new Error(message);
}

function useOptimisticMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: NotificationsQueryKey,
  refetch: () => Promise<unknown>,
  createUpdater: (notificationId: string) => CacheUpdater,
  requestFactory: (notificationId: string) => AsyncOperation
) {
  return useCallback(
    async (notificationId: string) => {
      try {
        queryClient.setQueryData<NotificationsQueryData>(
          queryKey,
          createUpdater(notificationId)
        );
        await requestFactory(notificationId)();
        await refetch();
      } catch {
        await refetch();
      }
    },
    [createUpdater, queryClient, queryKey, refetch, requestFactory]
  );
}

function useNotificationsQuery(
  queryKey: NotificationsQueryKey
) {
  return useQuery<
    NotificationsQueryData,
    Error,
    NotificationsQueryData,
    NotificationsQueryKey
  >({
    queryKey,
    queryFn: async () => {
      const response = await fetch('/api/notifications');
      if (!response.ok) {
        if (response.status === 401) {
          return { notifications: [], unreadCount: 0 };
        }
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<NotificationsQueryData>;
    },
    enabled: true,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

function useBulkMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: NotificationsQueryKey,
  refetch: () => Promise<unknown>
) {
  return useCallback(async () => {
    try {
      queryClient.setQueryData<NotificationsQueryData>(
        queryKey,
        createMarkAllAsReadUpdater()
      );
      const response = await csrfFetch('/api/notifications/read-all', {
        method: 'POST',
      });
      await ensureMutationSuccess(response, '全部设为已读失败');
      await refetch();
    } catch {
      await refetch();
    }
  }, [queryClient, queryKey, refetch]);
}

function useClearMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: NotificationsQueryKey,
  refetch: () => Promise<unknown>
) {
  return useCallback(
    async (notificationId: string) => {
      try {
        queryClient.setQueryData<NotificationsQueryData>(
          queryKey,
          createClearNotificationUpdater(notificationId)
        );
        const response = await csrfFetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        });
        await ensureMutationSuccess(response, '忽略通知失败');
        await refetch();
      } catch {
        await refetch();
      }
    },
    [queryClient, queryKey, refetch]
  );
}

export function usePollingNotifications() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const queryKey = useMemo<NotificationsQueryKey>(
    () => queryKeys.notifications.list(session?.user?.id),
    [session?.user?.id]
  );

  const {
    data: notificationsData,
    isLoading,
    isError,
    error,
    isSuccess,
    refetch,
    status: queryStatus,
  } = useNotificationsQuery(queryKey);

  const loadingState = resolveAsyncState({
    isLoading,
    isError,
    isSuccess,
  });

  const normalizeNotifications = useMemo(
    () => createNotificationNormalizer(),
    []
  );

  const normalizedNotifications = useMemo<NotificationItem[]>(() => {
    if (!notificationsData?.notifications) {
      return [];
    }

    return normalizeNotifications(notificationsData.notifications);
  }, [normalizeNotifications, notificationsData]);

  const markAsReadRequest = useCallback(
    (notificationId: string) => async () => {
      const response = await csrfFetch(
        `/api/notifications/${notificationId}/read`,
        {
        method: 'POST',
        }
      );
      await ensureMutationSuccess(response, '标记通知已读失败');
    },
    []
  );

  const markAsRead = useOptimisticMutation(
    queryClient,
    queryKey,
    refetch,
    createMarkAsReadUpdater,
    markAsReadRequest
  );

  const markAllAsRead = useBulkMutation(queryClient, queryKey, refetch);
  const clearNotification = useClearMutation(queryClient, queryKey, refetch);

  return {
    notifications: normalizedNotifications,
    unreadCount: notificationsData?.unreadCount ?? 0,
    loadingState,
    isLoading: loadingState.isLoading,
    isError: loadingState.isError,
    status: queryStatus,
    error,
    markAsRead,
    markAllAsRead,
    clearNotification,
  };
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { queryKeys } from '@/lib/queryKeys';
import type { NotificationItem } from '@/lib/types/layout';
import type {
  NotificationsQueryData,
  RawNotificationItem,
} from '@/lib/types/notifications';
import { resolveAsyncState } from '@/lib/utils/async-state';

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

function useAuthenticationGuard() {
  const { data: session, status } = useSession();
  const isFullyAuthenticated =
    status === 'authenticated' &&
    !!session?.user?.id &&
    session.user.id.length > 0;

  const hasInitializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isFullyAuthenticated) {
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        const timer = setTimeout(() => setIsReady(true), 300);
        return () => clearTimeout(timer);
      }
      setIsReady(true);
    } else {
      setIsReady(false);
      hasInitializedRef.current = false;
    }

    return undefined;
  }, [isFullyAuthenticated]);

  return {
    isReady,
    session,
    status,
  };
}

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
  queryKey: NotificationsQueryKey,
  isReady: boolean,
  session: ReturnType<typeof useSession>['data']
) {
  return useQuery<
    NotificationsQueryData,
    Error,
    NotificationsQueryData,
    NotificationsQueryKey
  >({
    queryKey,
    queryFn: async () => {
      if (!session?.user?.id) {
        return { notifications: [], unreadCount: 0 };
      }

      const response = await fetch('/api/notifications');
      if (!response.ok) {
        if (response.status === 401) {
          return { notifications: [], unreadCount: 0 };
        }
        throw new Error('Failed to fetch notifications');
      }
      return response.json() as Promise<NotificationsQueryData>;
    },
    enabled: isReady,
    refetchInterval: isReady ? 60 * 1000 : false,
    refetchOnWindowFocus: isReady,
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
      await fetch('/api/notifications/read-all', { method: 'POST' });
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
        await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        });
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
  const { isReady, session } = useAuthenticationGuard();
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
  } = useNotificationsQuery(queryKey, isReady, session);

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
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });
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

import type { NotificationItem } from '@/lib/types/layout';

export type RawNotificationItem = Omit<
  NotificationItem,
  'createdAt' | 'href'
> & {
  createdAt: string | Date;
  href?: string | null;
};

export interface NotificationsQueryData {
  notifications: RawNotificationItem[];
  unreadCount: number;
}

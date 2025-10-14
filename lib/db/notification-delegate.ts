import type { PrismaClient } from '@prisma/client';

/**
 * 轻量的通知记录类型定义，确保在缺少 Prisma 模型时也具备最小类型支持
 */
export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  href?: string | null;
  createdAt: Date;
  updatedAt?: Date;
}

type NotificationDelegate = {
  findFirst: (
    args: Record<string, unknown>
  ) => Promise<NotificationRecord | null>;
  findMany: (args: Record<string, unknown>) => Promise<NotificationRecord[]>;
  update: (args: Record<string, unknown>) => Promise<NotificationRecord>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  count: (args: Record<string, unknown>) => Promise<number>;
  delete: (args: Record<string, unknown>) => Promise<NotificationRecord>;
};

/**
 * 安全地获取 Prisma 的通知委托，在模型缺失时返回 null
 */
export function getNotificationDelegate(
  client: PrismaClient
): NotificationDelegate | null {
  const candidate = (
    client as unknown as { notification?: NotificationDelegate }
  ).notification;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  return candidate;
}

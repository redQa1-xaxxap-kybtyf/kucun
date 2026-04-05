import type { NotificationItem } from '@/lib/types/layout';

import { listDashboardTodoItems } from './dashboard-todo-service';

function toNotificationType(
  priority: 'urgent' | 'high' | 'medium' | 'low'
): NotificationItem['type'] {
  switch (priority) {
    case 'urgent':
      return 'error';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
    default:
      return 'success';
  }
}

export async function listFallbackNotifications(params: {
  hiddenIds?: Set<string>;
  limit?: number;
  readIds?: Set<string>;
  userId: string;
}): Promise<NotificationItem[]> {
  const {
    hiddenIds = new Set<string>(),
    limit = 20,
    readIds = new Set<string>(),
    userId,
  } = params;
  const todos = await listDashboardTodoItems(userId, Math.max(limit * 2, 20));

  return todos
    .map(todo => {
      const notificationId = `todo:${todo.id}`;

      return {
        id: notificationId,
        title: todo.title,
        message: todo.description,
        type: toNotificationType(todo.priority),
        isRead: readIds.has(notificationId),
        href: todo.url,
        createdAt:
          todo.createdAt instanceof Date
            ? todo.createdAt
            : new Date(todo.createdAt),
      } satisfies NotificationItem;
    })
    .filter(notification => !hiddenIds.has(notification.id))
    .slice(0, limit);
}

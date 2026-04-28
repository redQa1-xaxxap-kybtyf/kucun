'use client';

import { BellRing, CheckCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePollingNotifications } from '@/hooks/use-polling-notifications';
import type { NotificationItem } from '@/lib/types/layout';

type FilterMode = 'all' | 'unread';

const typeMeta: Record<
  NotificationItem['type'],
  { badgeClassName: string; label: string }
> = {
  info: {
    label: '业务提醒',
    badgeClassName: 'bg-sky-50 text-sky-700',
  },
  success: {
    label: '已同步',
    badgeClassName: 'bg-emerald-50 text-emerald-700',
  },
  warning: {
    label: '待处理',
    badgeClassName: 'bg-amber-50 text-amber-700',
  },
  error: {
    label: '紧急',
    badgeClassName: 'bg-rose-50 text-rose-700',
  },
};

function formatNotificationTime(createdAt: Date): string {
  return createdAt.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function NotificationsPageClient() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    clearNotification,
  } = usePollingNotifications();
  const [filterMode, setFilterMode] = React.useState<FilterMode>('all');

  const visibleNotifications = React.useMemo(() => {
    if (filterMode === 'unread') {
      return notifications.filter(notification => !notification.isRead);
    }
    return notifications;
  }, [filterMode, notifications]);

  const handleOpenNotification = React.useCallback(
    async (notification: NotificationItem) => {
      void markAsRead(notification.id);
      if (notification.href) {
        router.push(notification.href);
      }
    },
    [markAsRead, router]
  );

  return (
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        <PageHeader
          title="通知中心"
          description="顶部铃铛与这里保持同步，集中查看待确认订单、库存预警和业务跟进提醒。"
          icon={<BellRing className="h-6 w-6 text-white" />}
          iconBgColor="hsl(var(--color-info))"
          actions={
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('all')}
              >
                全部
              </Button>
              <Button
                variant={filterMode === 'unread' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterMode('unread')}
              >
                仅未读
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                全部设为已读
              </Button>
            </div>
          }
        />

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="提醒总数"
            value={notifications.length}
            description="当前提醒"
          />
          <SummaryCard
            title="未读提醒"
            value={unreadCount}
            description="未读事项"
          />
          <SummaryCard
            title="当前筛选"
            value={filterMode === 'all' ? '全部' : '未读'}
            description="筛选结果"
          />
        </div>

        <Card>
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900">
              通知列表
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-slate-500">通知加载中...</div>
            ) : visibleNotifications.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-500">
                  <BellRing className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {filterMode === 'unread'
                      ? '当前没有未读提醒'
                      : '当前没有需要处理的提醒'}
                  </div>
                  <div className="mt-1 text-xs leading-6 text-slate-500">
                    新的待确认订单、库存预警和业务跟进，会自动同步到这里。
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {visibleNotifications.map(notification => {
                  const meta = typeMeta[notification.type];

                  return (
                    <div
                      key={notification.id}
                      className="flex flex-col gap-4 px-4 py-4 sm:px-6"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={meta.badgeClassName}>
                              {meta.label}
                            </Badge>
                            {!notification.isRead && (
                              <Badge
                                variant="outline"
                                className="border-blue-200 bg-blue-50 text-blue-700"
                              >
                                未读
                              </Badge>
                            )}
                            <span className="text-xs font-medium text-slate-400">
                              {formatNotificationTime(notification.createdAt)}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-900">
                            {notification.title}
                          </div>
                          <div className="text-sm leading-6 text-slate-600">
                            {notification.message}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:justify-end">
                          {!notification.isRead && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              标记已读
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => clearNotification(notification.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            忽略
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleOpenNotification(notification)}
                            disabled={!notification.href}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            去处理
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="text-xs font-bold text-slate-500">{title}</div>
        <div className="text-2xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>
        <div className="text-xs leading-5 text-slate-500">{description}</div>
      </CardContent>
    </Card>
  );
}

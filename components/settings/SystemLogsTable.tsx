/**
 * 系统日志表格组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { ChevronLeft, ChevronRight, Eye, Loader2, User } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SystemLog, SystemLogType } from '@/lib/types/settings';
import { cn } from '@/lib/utils';

interface SystemLogsTableProps {
  /** 日志列表 */
  logs: SystemLog[];
  /** 总记录数 */
  total: number;
  /** 当前页码 */
  page: number;
  /** 每页记录数 */
  limit: number;
  /** 总页数 */
  totalPages: number;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 页码变更回调 */
  onPageChange: (page: number) => void;
  /** 查看详情回调 */
  onViewDetail?: (log: SystemLog) => void;
}

// 日志类型标签配置
const LOG_TYPE_CONFIG: Record<
  SystemLogType,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
  }
> = {
  user_action: { label: '用户操作', variant: 'default' },
  business_operation: { label: '业务操作', variant: 'secondary' },
  system_event: { label: '系统提醒', variant: 'outline' },
  error: { label: '异常记录', variant: 'destructive' },
  security: { label: '安全提醒', variant: 'destructive' },
};

/**
 * 系统日志表格组件
 */
export const SystemLogsTable = ({
  logs,
  total,
  page,
  limit,
  totalPages,
  isLoading = false,
  onPageChange,
  onViewDetail,
}: SystemLogsTableProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 w-full animate-pulse rounded-3xl bg-white/40"
          />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white/40 py-20 text-center backdrop-blur-md">
        <Loader2 className="mb-4 h-12 w-12 text-slate-200" />
        <p className="text-sm font-black tracking-widest text-slate-400 uppercase">
          当前暂无操作记录
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 日志流容器 */}
      <div className="relative space-y-4">
        {/* 时间轴基线 */}
        <div className="absolute top-0 bottom-0 left-10 w-px bg-slate-100" />

        {logs.map((log, index) => (
          <div
            key={log.id}
            className="group animate-in fade-in-50 slide-in-from-bottom-2 relative flex items-center gap-6"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* 时间轴圆点 */}
            <div className="relative z-10 flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-100 transition-all group-hover:scale-110 group-hover:ring-slate-900">
              <span className="text-xs font-black tracking-tighter text-slate-500 uppercase">
                {new Date(log.createdAt).toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span className="text-lg font-black tracking-tight text-slate-900">
                {new Date(log.createdAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </span>
            </div>

            {/* 日志内容卡片 */}
            <div className="flex flex-1 items-center justify-between rounded-2xl border border-white bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all duration-300 hover:border-slate-200 hover:bg-white/90 hover:shadow-lg hover:shadow-slate-200/50">
              <div className="flex min-w-0 items-center gap-6">
                {/* 类型与状态 */}
                <div className="flex flex-shrink-0 flex-col gap-2">
                  <Badge
                    variant={LOG_TYPE_CONFIG[log.type].variant}
                    className="rounded-lg px-2 text-xs font-black tracking-tight uppercase"
                  >
                    {LOG_TYPE_CONFIG[log.type].label}
                  </Badge>
                  <div
                    className={cn(
                      'h-1.5 w-6 rounded-full opacity-40',
                      log.level === 'critical' || log.level === 'error'
                        ? 'bg-rose-500'
                        : log.level === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    )}
                  />
                </div>

                {/* 核心操作描述 */}
                <div className="min-w-0">
                  <p className="truncate leading-tight font-black text-slate-900">
                    {log.action}
                  </p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-400">
                    {log.description}
                  </p>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-8">
                {/* 用户信息 */}
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">
                      {log.user?.name || '系统'}
                    </span>
                    <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <span className="font-mono">
                      IP: {log.ipAddress || '--'}
                    </span>
                    {log.ipLocation && <span>📍 {log.ipLocation}</span>}
                  </div>
                </div>

                {/* 操作按钮 */}
                {onViewDetail && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onViewDetail(log)}
                    className="h-12 w-12 rounded-2xl border-slate-100 text-slate-400 transition-all hover:bg-slate-900 hover:text-white active:scale-90"
                  >
                    <Eye className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 分页控制 (v3 PRO 胶囊风格) */}
      <div className="flex items-center justify-between rounded-3xl bg-white/40 p-4 backdrop-blur-md">
        <div className="ml-4 text-xs font-black tracking-widest text-slate-500 uppercase">
          记录：
          <span className="text-slate-900">
            {(page - 1) * limit + 1} - {Math.min(page * limit, total)}
          </span>{' '}
          / {total}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="h-10 rounded-xl font-bold text-slate-500 transition-all hover:bg-slate-900 hover:text-white"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一页
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum =
                totalPages <= 5 || page <= 3
                  ? i + 1
                  : page >= totalPages - 2
                    ? totalPages - 4 + i
                    : page - 2 + i;
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className={cn(
                    'h-10 w-10 rounded-xl font-black transition-all',
                    pageNum === page
                      ? 'bg-slate-900 text-white shadow-lg'
                      : 'text-slate-400 hover:bg-slate-100'
                  )}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="h-10 rounded-xl font-bold text-slate-500 transition-all hover:bg-slate-900 hover:text-white"
          >
            下一页
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

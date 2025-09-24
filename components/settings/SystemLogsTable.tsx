/**
 * 系统日志表格组件
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  SystemLog,
  SystemLogLevel,
  SystemLogType,
} from '@/lib/types/settings';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils/datetime';

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
  system_event: { label: '系统事件', variant: 'outline' },
  error: { label: '错误日志', variant: 'destructive' },
  security: { label: '安全日志', variant: 'destructive' },
};

// 日志级别配置
const LOG_LEVEL_CONFIG: Record<
  SystemLogLevel,
  { label: string; className: string }
> = {
  info: { label: '信息', className: 'text-blue-600 bg-blue-50' },
  warning: { label: '警告', className: 'text-yellow-600 bg-yellow-50' },
  error: { label: '错误', className: 'text-red-600 bg-red-50' },
  critical: { label: '严重', className: 'text-red-800 bg-red-100' },
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
  const formatDate = (dateString: string) => formatDateTime(dateString, 'yyyy-MM-dd HH:mm:ss') || dateString;

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>正在加载日志...</span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <p>暂无日志记录</p>
        <p className="text-sm">尝试调整筛选条件或检查系统是否有操作记录</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>时间</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>级别</TableHead>
              <TableHead>操作</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>用户</TableHead>
              <TableHead>IP地址</TableHead>
              <TableHead className="w-[100px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map(log => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-sm">
                  {formatDate(log.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant={LOG_TYPE_CONFIG[log.type].variant}>
                    {LOG_TYPE_CONFIG[log.type].label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-0',
                      LOG_LEVEL_CONFIG[log.level].className
                    )}
                  >
                    {LOG_LEVEL_CONFIG[log.level].label}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{log.action}</TableCell>
                <TableCell>
                  <span title={log.description}>
                    {truncateText(log.description)}
                  </span>
                </TableCell>
                <TableCell>
                  {log.user ? (
                    <div className="space-y-1">
                      <div className="font-medium">{log.user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{log.user.username}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">系统</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {log.ipAddress || '-'}
                </TableCell>
                <TableCell>
                  {onViewDetail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 分页信息和控制 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，
          共 {total} 条记录
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </Button>

          <div className="flex items-center space-x-1">
            {/* 显示页码 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(pageNum)}
                  className="h-8 w-8 p-0"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

/**
 * 系统日志页面
 * 严格遵循全栈项目统一约定规范
 */

'use client';

import React from 'react';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Trash2 } from 'lucide-react';

import { LogFilters } from '@/components/settings/LogFilters';
import { SystemLogsTable } from '@/components/settings/SystemLogsTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type {
  SettingsApiResponse,
  SystemLogFilters,
  SystemLogListResponse,
} from '@/lib/types/settings';

export default function LogsSettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = React.useState<SystemLogFilters>({});
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);
  const [confirmText, setConfirmText] = React.useState('');

  // 获取系统日志列表
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['system-logs', page, limit, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      // 添加筛选参数
      if (filters.type) params.append('type', filters.type);
      if (filters.level) params.append('level', filters.level);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/settings/logs?${params}`);
      if (!response.ok) {
        throw new Error('获取系统日志失败');
      }
      const result: SettingsApiResponse<SystemLogListResponse> =
        await response.json();
      if (!result.success) {
        throw new Error(result.error || '获取系统日志失败');
      }
      if (!result.data) {
        throw new Error('获取系统日志数据失败');
      }
      return result.data;
    },
  });

  // 清空所有日志的mutation
  const clearAllLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/settings/logs?clearAll=true', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('清空日志失败');
      }

      const result: SettingsApiResponse<{
        message: string;
        deletedCount: number;
      }> = await response.json();

      if (!result.success) {
        throw new Error(result.error || '清空日志失败');
      }

      if (!result.data) {
        throw new Error('清空日志数据获取失败');
      }
      return result.data;
    },
    onSuccess: data => {
      toast({
        title: '清空成功',
        description: `已清空 ${data.deletedCount} 条系统日志`,
        variant: 'success',
      });
      // 刷新日志列表
      queryClient.invalidateQueries({ queryKey: ['system-logs'] });
      // 重置确认文本
      setConfirmText('');
    },
    onError: (error: Error) => {
      toast({
        title: '清空失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 检查权限
  if (session?.user?.role !== 'admin') {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回设置
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">系统日志</h1>
              <p className="text-muted-foreground">系统操作记录和审计日志</p>
            </div>
          </div>
        </div>
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center text-amber-800">
              <FileText className="mr-2 h-5 w-5" />
              权限不足
            </CardTitle>
            <CardDescription className="text-amber-700">
              只有管理员可以查看系统日志。
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleFiltersChange = (newFilters: SystemLogFilters) => {
    setFilters(newFilters);
    setPage(1); // 重置到第一页
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleClearAllLogs = () => {
    if (confirmText !== '确认清空') {
      toast({
        title: '确认文本错误',
        description: '请输入"确认清空"来确认操作',
        variant: 'destructive',
      });
      return;
    }
    clearAllLogsMutation.mutate();
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题和导航 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回设置
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">系统日志</h1>
            <p className="text-muted-foreground">系统操作记录和审计日志</p>
          </div>
        </div>

        {/* 清空日志按钮 - 只有管理员可见 */}
        {session?.user?.role === 'admin' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                清空日志
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center text-red-600">
                  <Trash2 className="mr-2 h-5 w-5" />
                  确认清空所有系统日志
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <div className="font-medium text-red-700">
                      ⚠️ 此操作将永久删除所有系统日志，无法恢复！
                    </div>
                    <div>
                      这将删除包括用户操作、业务操作、系统事件、错误和安全日志在内的所有记录。
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="confirm-text"
                        className="text-sm font-medium"
                      >
                        请输入{' '}
                        <span className="font-bold text-red-600">
                          &ldquo;确认清空&rdquo;
                        </span>{' '}
                        来确认操作：
                      </Label>
                      <Input
                        id="confirm-text"
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        placeholder="确认清空"
                        className="border-red-200 focus:border-red-400"
                      />
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmText('')}>
                  取消
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearAllLogs}
                  disabled={
                    confirmText !== '确认清空' || clearAllLogsMutation.isPending
                  }
                  className="bg-red-600 hover:bg-red-700"
                >
                  {clearAllLogsMutation.isPending ? '清空中...' : '确认清空'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* 日志筛选器 */}
      <LogFilters filters={filters} onFiltersChange={handleFiltersChange} />

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            系统日志
          </CardTitle>
          <CardDescription>
            查看和管理系统操作记录、错误日志和安全审计信息
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <p>加载日志失败</p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="mt-2"
              >
                重试
              </Button>
            </div>
          ) : (
            <SystemLogsTable
              logs={logsData?.logs || []}
              total={logsData?.total || 0}
              page={page}
              limit={limit}
              totalPages={logsData?.totalPages || 0}
              isLoading={isLoading}
              onPageChange={handlePageChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

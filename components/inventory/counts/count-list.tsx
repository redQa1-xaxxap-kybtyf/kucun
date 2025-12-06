'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Pencil, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { useToast } from '@/components/ui/use-toast';
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/queryKeys';
import {
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountStatus,
  type InventoryCountQueryParams,
} from '@/lib/types/inventory-count';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDate } from '@/lib/utils/datetime';

interface CountListProps {
  filters: InventoryCountQueryParams;
}

export function CountList({ filters }: CountListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCountId, setSelectedCountId] = React.useState<string>('');

  // 权限检查
  const hasManagePermission = React.useMemo(
    () => can(session?.user ?? null, 'inventory:manage'),
    [session?.user]
  );

  // 查询盘点计划列表
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.inventory.countsList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());
      if (filters.status) params.set('status', filters.status);
      if (filters.countType) params.set('countType', filters.countType);
      if (filters.location) params.set('location', filters.location);
      if (filters.categoryId) params.set('categoryId', filters.categoryId);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

      const response = await fetch(
        `/api/inventory/counts?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error('获取盘点计划列表失败');
      }
      return response.json();
    },
  });

  // 删除盘点计划
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/inventory/counts/${id}`,
        getCsrfTokenHeader({
          method: 'DELETE',
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '删除失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: '盘点计划已成功删除',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除盘点计划后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 开始盘点
  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/inventory/counts/${id}/start`,
        getCsrfTokenHeader({
          method: 'POST',
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '开始盘点失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '开始成功',
        description: '盘点计划已开始',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户开始盘点后立即看到状态变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '开始失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDelete = (id: string) => {
    setSelectedCountId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteMutation.mutate(selectedCountId);
    setDeleteDialogOpen(false);
  };

  const handleStart = (id: string) => {
    startMutation.mutate(id);
  };

  const getStatusBadgeVariant = (status: CountStatus) => {
    const variants: Record<
      CountStatus,
      'default' | 'secondary' | 'outline' | 'destructive'
    > = {
      draft: 'outline',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return variants[status];
  };

  if (isLoading) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  const counts = data?.data?.counts || [];

  if (counts.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-10 text-sm">
        <span>暂无盘点计划</span>
        {hasManagePermission && (
          <Button size="sm" asChild>
            <Link href="/inventory/counts/new">新建盘点计划</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>盘点编号</TableHead>
              <TableHead>盘点名称</TableHead>
              <TableHead>盘点类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>计划日期</TableHead>
              <TableHead>进度</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {counts.map(
              (count: {
                id: string;
                countNumber: string;
                countName: string;
                countType: 'full' | 'partial' | 'cycle';
                status: CountStatus;
                planDate: string;
                totalItems: number;
                completedItems: number;
              }) => (
                <TableRow key={count.id}>
                  <TableCell className="font-medium">
                    {count.countNumber}
                  </TableCell>
                  <TableCell>{count.countName}</TableCell>
                  <TableCell>{COUNT_TYPE_LABELS[count.countType]}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(count.status)}>
                      {COUNT_STATUS_LABELS[count.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(count.planDate)}</TableCell>
                  <TableCell>
                    {count.totalItems > 0
                      ? `${count.completedItems}/${count.totalItems}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/inventory/counts/${count.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>

                      {hasManagePermission && count.status === 'draft' && (
                        <>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/inventory/counts/${count.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStart(count.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(count.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 md:hidden">
        {counts.map(
          (count: {
            id: string;
            countNumber: string;
            countName: string;
            countType: 'full' | 'partial' | 'cycle';
            status: CountStatus;
            planDate: string;
            totalItems: number;
            completedItems: number;
          }) => (
            <div
              key={count.id}
              className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    盘点编号
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {count.countNumber}
                  </div>
                </div>
                <Badge variant={getStatusBadgeVariant(count.status)}>
                  {COUNT_STATUS_LABELS[count.status]}
                </Badge>
              </div>
              <div className="mt-2 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                {count.countName}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                <span>类型：{COUNT_TYPE_LABELS[count.countType]}</span>
                <span>计划：{formatDate(count.planDate)}</span>
                <span>
                  进度：
                  {count.totalItems > 0
                    ? `${count.completedItems}/${count.totalItems}`
                    : '-'}
                </span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/inventory/counts/${count.id}`}>
                    <Eye className="mr-1 h-3 w-3" />
                    详情
                  </Link>
                </Button>

                {hasManagePermission && count.status === 'draft' && (
                  <>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/inventory/counts/${count.id}/edit`}>
                        <Pencil className="mr-1 h-3 w-3" />
                        编辑
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleStart(count.id)}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      开始
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(count.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  </>
                )}
              </div>
            </div>
          )
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此盘点计划吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

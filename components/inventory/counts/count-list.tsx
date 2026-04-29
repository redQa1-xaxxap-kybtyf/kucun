'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Loader2, Pencil, Play, Trash2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { formatDate } from '@/lib/utils/datetime';

interface CountListProps {
  filters: InventoryCountQueryParams;
  isSearching?: boolean;
}

interface CountListItem {
  id: string;
  countNumber: string;
  countName: string;
  countType: 'full' | 'partial' | 'cycle';
  status: CountStatus;
  planDate: string;
  location?: string;
  totalItems: number;
  completedItems: number;
}

export function CountList({ filters, isSearching = false }: CountListProps) {
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
  const { data, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.inventory.countsList(filters),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set('page', filters.page.toString());
      if (filters.pageSize) params.set('pageSize', filters.pageSize.toString());
      if (filters.search) params.set('search', filters.search);
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
        throw new Error('获取盘点单列表失败');
      }
      return response.json();
    },
    placeholderData: previousData => previousData,
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
        description: '盘点单已成功删除',
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
        description: '盘点单已开始，可以继续录入盘点结果',
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

  const formatProgress = (completedItems: number, totalItems: number) => {
    if (totalItems <= 0) {
      return '-';
    }

    const percent = Math.round((completedItems / totalItems) * 100);
    return `${completedItems}/${totalItems} · ${percent}%`;
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

  const counts = data?.data?.counts || [];
  const isInitialLoading = isLoading && !data;
  const isListRefreshing = !isInitialLoading && (isFetching || isSearching);

  if (!isInitialLoading && counts.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-10 text-sm">
        <span>暂无盘点单</span>
        {hasManagePermission && (
          <Button size="sm" asChild>
            <Link href="/inventory/counts/new">新建盘点单</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm"
      aria-busy={isInitialLoading || isListRefreshing}
    >
      {isListRefreshing && (
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center border-b border-[hsl(var(--color-border-primary))] bg-white/95 px-3 py-2 text-xs font-medium text-[hsl(var(--color-text-secondary))] shadow-sm">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-[hsl(var(--color-primary))]" />
          正在更新
        </div>
      )}

      {/* 桌面端表格视图 */}
      <div
        className={cn(
          'hidden overflow-x-auto transition-opacity lg:block',
          isListRefreshing && 'opacity-60'
        )}
      >
        <Table className="min-w-[960px] [&_th]:whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>盘点编号</TableHead>
              <TableHead>盘点单名称</TableHead>
              <TableHead>盘点类型</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>计划日期</TableHead>
              <TableHead>库位/存放区域</TableHead>
              <TableHead>盘点进度</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading ? (
              <TableLoadingRows />
            ) : (
              counts.map((count: CountListItem) => (
                <TableRow key={count.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {count.countNumber}
                  </TableCell>
                  <TableCell className="min-w-[180px]">
                    <div className="max-w-[220px] truncate">
                      {count.countName}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {COUNT_TYPE_LABELS[count.countType]}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={getStatusBadgeVariant(count.status)}>
                      {COUNT_STATUS_LABELS[count.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(count.planDate)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {count.location || '全部库存'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatProgress(count.completedItems, count.totalItems)}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div
        className={cn(
          'space-y-3 p-3 transition-opacity lg:hidden',
          isListRefreshing && 'opacity-60'
        )}
      >
        {isInitialLoading ? (
          <MobileLoadingSkeleton />
        ) : (
          counts.map((count: CountListItem) => (
          <div
            key={count.id}
            className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-sm"
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
              <span>库位/区域：{count.location || '全部库存'}</span>
              <span>
                盘点进度：
                {formatProgress(count.completedItems, count.totalItems)}
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
                    开始盘点
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
          ))
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除此盘点单吗？此操作不可撤销。
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
    </div>
  );
}

function TableLoadingRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIndex) => (
        <TableRow key={`count-loading-row-${rowIndex}`}>
          {Array.from({ length: 8 }).map((__, colIndex) => (
            <TableCell key={colIndex} className="h-12">
              <div className="h-3 w-full max-w-[140px] animate-pulse rounded bg-slate-100" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function MobileLoadingSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`count-card-loading-${index}`}
          className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </>
  );
}

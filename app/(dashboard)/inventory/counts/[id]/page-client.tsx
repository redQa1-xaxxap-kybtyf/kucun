'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Pencil, Play, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { CountItemsTable } from '@/components/inventory/counts/count-items-table';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/queryKeys';
import {
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountStatus,
  type InventoryCountDetail,
} from '@/lib/types/inventory-count';

interface CountDetailPageClientProps {
  countId: string;
  initialData: InventoryCountDetail;
}

export function CountDetailPageClient({
  countId,
  initialData,
}: CountDetailPageClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: session } = useSession();
  const hasManagePermission = React.useMemo(
    () => can(session?.user ?? null, 'inventory:manage'),
    [session?.user]
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

  const count = useCountDetail(countId, initialData);
  const mutations = useCountMutations({ countId, toast, queryClient, router });

  const handleDelete = React.useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = React.useCallback(() => {
    setDeleteDialogOpen(false);
    mutations.deleteCount();
  }, [mutations]);

  if (!count) {
    return null;
  }

  return (
    <CountDetailLayout
      count={count}
      countId={countId}
      hasManagePermission={hasManagePermission}
      onStart={mutations.startCount}
      onComplete={mutations.completeCount}
      onRemove={handleDelete}
      isStarting={mutations.isStarting}
      isCompleting={mutations.isCompleting}
      isDeleting={mutations.isDeleting}
      deleteDialogOpen={deleteDialogOpen}
      onDeleteDialogChange={setDeleteDialogOpen}
      onConfirmDelete={handleConfirmDelete}
    />
  );
}

function useCountDetail(countId: string, initialData: InventoryCountDetail) {
  const { data } = useQuery({
    queryKey: queryKeys.inventory.count(countId),
    queryFn: async () => {
      const response = await fetch(`/api/inventory/counts/${countId}`);
      if (!response.ok) {
        throw new Error('获取盘点计划详情失败');
      }
      return response.json() as Promise<{ data: InventoryCountDetail }>;
    },
    initialData: { data: initialData },
  });

  return data?.data;
}

function useCountMutations({
  countId,
  toast,
  queryClient,
  router,
}: {
  countId: string;
  toast: ReturnType<typeof useToast>['toast'];
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
}) {
  const invalidateCount = React.useCallback(() => {
    // ✅ 使用 refetchQueries 强制立即刷新，确保用户操作后立即看到变化
    queryClient.refetchQueries({
      queryKey: queryKeys.inventory.count(countId),
      type: 'active',
    });
    queryClient.refetchQueries({
      queryKey: queryKeys.inventory.counts(),
      type: 'active',
    });
  }, [countId, queryClient]);

  const startMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/inventory/counts/${countId}/start`, { method: 'POST' }).then(
        handleResponse('开始盘点失败')
      ),
    onSuccess: () => {
      toast({ title: '开始成功', description: '盘点计划已开始' });
      invalidateCount();
    },
    onError: error =>
      toast({
        title: '开始失败',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/inventory/counts/${countId}/complete`, {
        method: 'POST',
      }).then(handleResponse('完成盘点失败')),
    onSuccess: () => {
      toast({ title: '完成成功', description: '盘点计划已完成' });
      invalidateCount();
    },
    onError: error =>
      toast({
        title: '完成失败',
        description: error.message,
        variant: 'destructive',
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/inventory/counts/${countId}`, {
        method: 'DELETE',
      }).then(handleResponse('删除失败')),
    onSuccess: () => {
      toast({ title: '删除成功', description: '盘点计划已成功删除' });
      // ✅ 使用 refetchQueries 强制立即刷新，确保用户删除盘点计划后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });
      router.push('/inventory/counts');
    },
    onError: error =>
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      }),
  });

  return {
    startCount: () => startMutation.mutate(),
    completeCount: () => completeMutation.mutate(),
    deleteCount: () => deleteMutation.mutate(),
    isStarting: startMutation.isPending,
    isCompleting: completeMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

interface CountDetailLayoutProps {
  count: InventoryCountDetail;
  countId: string;
  hasManagePermission: boolean;
  onStart: () => void;
  onComplete: () => void;
  onRemove: () => void;
  isStarting: boolean;
  isCompleting: boolean;
  isDeleting: boolean;
  deleteDialogOpen: boolean;
  onDeleteDialogChange: (open: boolean) => void;
  onConfirmDelete: () => void;
}

function CountDetailLayout({
  count,
  countId,
  hasManagePermission,
  onStart,
  onComplete,
  onRemove,
  isStarting,
  isCompleting,
  isDeleting,
  deleteDialogOpen,
  onDeleteDialogChange,
  onConfirmDelete,
}: CountDetailLayoutProps) {
  return (
    <div className="space-y-6 p-6">
      <CountHeader
        count={count}
        countId={countId}
        hasManagePermission={hasManagePermission}
        onStart={onStart}
        onComplete={onComplete}
        onRemove={onRemove}
        isStarting={isStarting}
        isCompleting={isCompleting}
        isDeleting={isDeleting}
      />

      <CountInfoSection count={count} />
      <CountStatisticsSection count={count} />
      <CountItemsCard items={count.items || []} />

      <DeleteCountDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogChange}
        onConfirm={onConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}

interface CountHeaderProps {
  count: InventoryCountDetail;
  countId: string;
  hasManagePermission: boolean;
  onStart: () => void;
  onComplete: () => void;
  onRemove: () => void;
  isStarting: boolean;
  isCompleting: boolean;
  isDeleting: boolean;
}

function CountHeader({
  count,
  countId,
  hasManagePermission,
  onStart,
  onComplete,
  onRemove,
  isStarting,
  isCompleting,
  isDeleting,
}: CountHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="sm" asChild className="gap-2">
        <Link href="/inventory/counts">
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </Link>
      </Button>

      {hasManagePermission && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            disabled={isDeleting}
            className="gap-2"
          >
            <Link href={`/inventory/counts/${countId}/edit`}>
              <Pencil className="h-4 w-4" /> 编辑
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onStart}
            disabled={count.status !== 'draft' || isStarting}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {isStarting ? '开始中…' : '开始盘点'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onComplete}
            disabled={count.status !== 'in_progress' || isCompleting}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {isCompleting ? '完成中…' : '完成盘点'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            disabled={count.status !== 'draft' || isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" /> 删除
          </Button>
        </div>
      )}
    </div>
  );
}

function CountInfoSection({ count }: { count: InventoryCountDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>基本信息</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <InfoItem label="盘点名称" value={count.countName} />
          <InfoItem
            label="盘点类型"
            value={COUNT_TYPE_LABELS[count.countType]}
          />
          <div>
            <div className="text-muted-foreground text-sm">状态</div>
            <Badge variant={getStatusBadgeVariant(count.status)}>
              {COUNT_STATUS_LABELS[count.status]}
            </Badge>
          </div>
          <InfoItem
            label="计划日期"
            value={format(new Date(count.planDate), 'yyyy-MM-dd')}
          />
          <InfoItem label="盘点位置" value={count.location || '-'} />
          <InfoItem label="盘点分类" value={count.category?.name || '-'} />
          <InfoItem label="创建人" value={count.creator?.name || '-'} />
          <InfoItem
            label="创建时间"
            value={format(new Date(count.createdAt), 'yyyy-MM-dd HH:mm')}
          />
        </div>
        {count.remarks && (
          <div className="mt-4">
            <div className="text-muted-foreground text-sm">备注</div>
            <div className="font-medium">{count.remarks}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CountStatisticsSection({ count }: { count: InventoryCountDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatisticCard title="总明细数" value={formatNumber(count.totalItems)} />
      <StatisticCard
        title="已盘点数"
        value={formatNumber(count.completedItems)}
      />
      <StatisticCard
        title="差异明细数"
        value={formatNumber(count.differenceItems)}
      />
      <StatisticCard
        title="差异总金额"
        value={formatNumber(count.totalDifference)}
      />
    </div>
  );
}

function CountItemsCard({ items }: { items: InventoryCountDetail['items'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>盘点明细</CardTitle>
      </CardHeader>
      <CardContent>
        <CountItemsTable items={items || []} />
      </CardContent>
    </Card>
  );
}

function DeleteCountDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除</AlertDialogTitle>
          <AlertDialogDescription>
            确定要删除此盘点计划吗？此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? '删除中…' : '确认删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-sm">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function StatisticCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function getStatusBadgeVariant(
  status: CountStatus
): 'default' | 'warning' | 'success' {
  switch (status) {
    case 'draft':
      return 'default';
    case 'in_progress':
      return 'warning';
    case 'completed':
      return 'success';
    default:
      return 'default';
  }
}

function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) {
    return '0';
  }
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(value);
}

function handleResponse(errorMessage: string) {
  return async (response: Response) => {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || errorMessage);
    }
    return response.json();
  };
}

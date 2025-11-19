'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Save } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { can } from '@/lib/auth/permissions';
import {
  COUNT_ITEM_STATUS_LABELS,
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountItemStatus,
  type InventoryCountDetail,
  type InventoryCountItem,
} from '@/lib/types/inventory-count';

interface ExecuteCountPageClientProps {
  countId: string;
  initialData: InventoryCountDetail;
}

interface ItemQuantity {
  id: string;
  actualQuantity: number | null;
}

export function ExecuteCountPageClient({
  countId,
  initialData,
}: ExecuteCountPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

  // 实际数量状态
  const [quantities, setQuantities] = React.useState<
    Record<string, number | null>
  >(() => {
    const initial: Record<string, number | null> = {};
    initialData.items?.forEach(item => {
      initial[item.id] = item.actualQuantity ?? null;
    });
    return initial;
  });

  // 提交盘点数据
  const submitMutation = useMutation({
    mutationFn: async (data: ItemQuantity[]) => {
      const response = await fetch(`/api/inventory/counts/${countId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: data }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '提交盘点数据失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '提交成功',
        description: '盘点数据已成功提交',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户提交盘点数据后立即看到变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.count(countId),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '提交失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 完成盘点
  const completeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/inventory/counts/${countId}/complete`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '完成盘点失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '完成成功',
        description: '盘点计划已完成',
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户完成盘点后立即看到状态变化
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.count(countId),
        type: 'active',
      });
      queryClient.refetchQueries({
        queryKey: queryKeys.inventory.counts(),
        type: 'active',
      });

      router.push(`/inventory/counts/${countId}`);
    },
    onError: (error: Error) => {
      toast({
        title: '完成失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setQuantities(prev => ({ ...prev, [itemId]: numValue }));
  };

  const handleSetSystemQuantity = () => {
    const newQuantities: Record<string, number | null> = {};
    initialData.items?.forEach(item => {
      newQuantities[item.id] = item.systemQuantity;
    });
    setQuantities(newQuantities);
  };

  const handleClearQuantities = () => {
    const newQuantities: Record<string, number | null> = {};
    initialData.items?.forEach(item => {
      newQuantities[item.id] = null;
    });
    setQuantities(newQuantities);
  };

  const handleSubmit = () => {
    const data: ItemQuantity[] = Object.entries(quantities)
      .filter(([, qty]) => qty !== null)
      .map(([id, actualQuantity]) => ({
        id,
        actualQuantity: actualQuantity as number,
      }));

    if (data.length === 0) {
      toast({
        title: '提交失败',
        description: '请至少录入一条实际数量',
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate(data);
  };

  const handleComplete = () => {
    completeMutation.mutate();
  };

  const calculateDifference = (item: InventoryCountItem) => {
    const actualQty = quantities[item.id];
    if (actualQty === null || actualQty === undefined) return null;
    return actualQty - item.systemQuantity;
  };

  const calculateTotalCost = (item: InventoryCountItem) => {
    if (!hasFinancePermission) {
      return null;
    }
    const diff = calculateDifference(item);
    if (diff === null || !item.unitCost) return null;
    return diff * item.unitCost;
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getStatusBadgeVariant = (status: CountItemStatus) => {
    const variants: Record<
      CountItemStatus,
      'default' | 'secondary' | 'outline'
    > = {
      pending: 'outline',
      counted: 'default',
      adjusted: 'secondary',
    };
    return variants[status];
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/inventory/counts/${countId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">执行盘点</h1>
            <p className="text-muted-foreground">{initialData.countNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" />
            保存数据
          </Button>
          <Button onClick={handleComplete}>
            <CheckCircle className="mr-2 h-4 w-4" />
            完成盘点
          </Button>
        </div>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <div className="text-muted-foreground text-sm">盘点名称</div>
              <div className="font-medium">{initialData.countName}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">盘点类型</div>
              <div className="font-medium">
                {COUNT_TYPE_LABELS[initialData.countType]}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">状态</div>
              <Badge variant="default">
                {COUNT_STATUS_LABELS[initialData.status]}
              </Badge>
            </div>
            <div>
              <div className="text-muted-foreground text-sm">计划日期</div>
              <div className="font-medium">
                {format(new Date(initialData.planDate), 'yyyy-MM-dd')}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 盘点明细 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>盘点明细</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSetSystemQuantity}
              >
                全部设为系统数量
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearQuantities}
              >
                清空实际数量
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>规格型号</TableHead>
                  <TableHead>批次号</TableHead>
                  <TableHead className="text-right">系统数量</TableHead>
                  <TableHead className="text-right">实际数量</TableHead>
                  <TableHead className="text-right">差异数量</TableHead>
                  {hasFinancePermission && (
                    <>
                      <TableHead className="text-right">单位成本</TableHead>
                      <TableHead className="text-right">差异金额</TableHead>
                    </>
                  )}
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialData.items?.map(item => {
                  const diff = calculateDifference(item);
                  const totalCost = calculateTotalCost(item);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product?.code || '-'}
                      </TableCell>
                      <TableCell>{item.product?.name || '-'}</TableCell>
                      <TableCell>
                        {item.variant
                          ? `${item.variant.colorName || ''} ${item.variant.sku || ''}`.trim() ||
                            '-'
                          : '-'}
                      </TableCell>
                      <TableCell>{item.batchNumber || '-'}</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(item.systemQuantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quantities[item.id] ?? ''}
                          onChange={e =>
                            handleQuantityChange(item.id, e.target.value)
                          }
                          className="w-32 text-right"
                        />
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          diff !== null && diff !== 0
                            ? diff > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                            : ''
                        }`}
                      >
                        {formatNumber(diff)}
                      </TableCell>
                      {hasFinancePermission && (
                        <>
                          <TableCell className="text-right">
                            {formatNumber(item.unitCost)}
                          </TableCell>
                          <TableCell
                            className={`text-right ${
                              totalCost !== null && totalCost !== 0
                                ? totalCost > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                                : ''
                            }`}
                          >
                            {formatNumber(totalCost)}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)}>
                          {COUNT_ITEM_STATUS_LABELS[item.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

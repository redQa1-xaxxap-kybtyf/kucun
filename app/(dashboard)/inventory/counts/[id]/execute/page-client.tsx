'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/queryKeys';
import {
    COUNT_ITEM_STATUS_LABELS,
    COUNT_STATUS_LABELS,
    COUNT_TYPE_LABELS,
    type CountItemStatus,
    type InventoryCountDetail,
    type InventoryCountItem,
} from '@/lib/types/inventory-count';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import { ProductDataUtils } from '@/lib/utils/product-data';

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
      const response = await fetch(
        `/api/inventory/counts/${countId}/submit`,
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: data }),
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        // 提取详细错误信息，提供具体的修复指导
        const errorMessage = errorData.error || errorData.message || '';
        const details = errorData.details || '';
        
        // 构建用户友好的错误消息
        let userMessage = '提交盘点数据失败';
        if (errorMessage.includes('负数') || errorMessage.includes('negative')) {
          userMessage = '提交失败：库存数量不能为负数，请检查实际数量后重试';
        } else if (errorMessage.includes('权限') || response.status === 403) {
          userMessage = '提交失败：您没有执行此操作的权限，请联系管理员';
        } else if (errorMessage.includes('不存在') || response.status === 404) {
          userMessage = '提交失败：盘点计划不存在或已被删除，请刷新页面后重试';
        } else if (errorMessage.includes('状态') || errorMessage.includes('status')) {
          userMessage = '提交失败：盘点计划状态已变更，请刷新页面查看最新状态';
        } else if (errorMessage) {
          userMessage = `提交失败：${errorMessage}${details ? `（${details}）` : ''}`;
        } else {
          userMessage = '提交失败：服务器暂时无法处理请求，请稍后重试';
        }
        
        throw new Error(userMessage);
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
        getCsrfTokenHeader({
          method: 'POST',
        })
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || errorData.message || '';
        
        // 构建用户友好的错误消息
        let userMessage = '完成盘点失败';
        if (errorMessage.includes('未录入') || errorMessage.includes('pending')) {
          userMessage = '完成失败：部分产品尚未录入实际数量，请确保所有产品都已盘点';
        } else if (errorMessage.includes('权限') || response.status === 403) {
          userMessage = '完成失败：您没有执行此操作的权限，请联系管理员';
        } else if (errorMessage.includes('状态') || errorMessage.includes('status')) {
          userMessage = '完成失败：盘点计划状态已变更，请刷新页面查看最新状态';
        } else if (errorMessage) {
          userMessage = `完成失败：${errorMessage}`;
        } else {
          userMessage = '完成失败：服务器暂时无法处理请求，请稍后重试';
        }
        
        throw new Error(userMessage);
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
    <div className="space-y-6 p-4 sm:p-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex flex-wrap gap-2 sm:justify-end">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>盘点明细</CardTitle>
            <div className="flex flex-wrap gap-2 sm:justify-end">
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
          {/* 桌面端表格 */}
          <div className="hidden rounded-md border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>规格型号</TableHead>
                  <TableHead className="text-right">每件片数</TableHead>
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
                      <TableCell className="whitespace-nowrap">
                        {(() => {
                          const variantLabel =
                            item.variant &&
                            `${item.variant.colorName || ''} ${item.variant.sku || ''}`.trim();

                          if (variantLabel) {
                            return variantLabel;
                          }

                          return ProductDataUtils.formatter.formatSpecification(
                            item.product?.specification
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.product?.piecesPerUnit &&
                        item.product.piecesPerUnit > 0
                          ? `${item.product.piecesPerUnit}片/件`
                          : '-'}
                      </TableCell>
                      <TableCell>{item.batchNumber || '-'}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {(() => {
                          const ppu = item.product?.piecesPerUnit ?? 0;
                          if (ppu <= 1) {
                            return `${item.systemQuantity}片`;
                          }
                          const result = calculatePieceDisplay(
                            item.systemQuantity,
                            ppu
                          );
                          return (
                            <>
                              <span>{item.systemQuantity}片</span>
                              <span className="text-muted-foreground ml-1 text-xs">
                                (约{result.displayText})
                              </span>
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={quantities[item.id] ?? ''}
                            onChange={e =>
                              handleQuantityChange(item.id, e.target.value)
                            }
                            className="h-8 w-28 text-right"
                          />
                        </div>
                      </TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${
                          diff !== null && diff !== 0
                            ? diff > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                            : ''
                        }`}
                      >
                        {(() => {
                          if (diff === null) return '-';
                          const ppu = item.product?.piecesPerUnit ?? 0;
                          const abs = Math.abs(diff);
                          const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
                          const mainText = sign
                            ? `${sign}${abs}片`
                            : `${abs}片`;

                          if (ppu <= 1) {
                            return mainText;
                          }

                          const result = calculatePieceDisplay(abs, ppu);
                          return (
                            <>
                              <span>{mainText}</span>
                              <span className="text-muted-foreground/80 ml-1 text-xs">
                                ({sign}
                                {result.displayText})
                              </span>
                            </>
                          );
                        })()}
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

          {/* 移动端卡片列表 */}
          <div className="space-y-3 md:hidden">
            {initialData.items?.map(item => {
              const diff = calculateDifference(item);
              const totalCost = calculateTotalCost(item);
              const ppu = item.product?.piecesPerUnit ?? 0;
              const systemText = (() => {
                if (ppu <= 1) return `${item.systemQuantity}片`;
                const result = calculatePieceDisplay(item.systemQuantity, ppu);
                return `${item.systemQuantity}片 (约${result.displayText})`;
              })();

              let diffText = '-';
              let diffClass = '';
              if (diff !== null) {
                const abs = Math.abs(diff);
                const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
                if (ppu <= 1) {
                  diffText = `${sign}${abs}片`;
                } else {
                  const result = calculatePieceDisplay(abs, ppu);
                  diffText = `${sign}${abs}片 (约${sign}${result.displayText})`;
                }
                if (diff > 0) diffClass = 'text-green-600';
                else if (diff < 0) diffClass = 'text-red-600';
              }

              return (
                <div
                  key={item.id}
                  className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {item.product?.code || '-'}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                        {item.product?.name || '未知产品'}
                      </div>
                      <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        规格：
                        {(() => {
                          const variantLabel =
                            item.variant &&
                            `${item.variant.colorName || ''} ${item.variant.sku || ''}`.trim();

                          if (variantLabel) {
                            return variantLabel;
                          }

                          return ProductDataUtils.formatter.formatSpecification(
                            item.product?.specification
                          );
                        })() || '-'}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                        <span>批次：{item.batchNumber || '-'}</span>
                        <span>
                          每件：
                          {ppu > 0 ? `${ppu}片/件` : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {COUNT_ITEM_STATUS_LABELS[item.status]}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                    <div>
                      <div>系统数量</div>
                      <div className="mt-0.5 font-medium text-[hsl(var(--color-text-primary))]">
                        {systemText}
                      </div>
                    </div>
                    <div>
                      <div>实际数量</div>
                      <div className="mt-0.5">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quantities[item.id] ?? ''}
                          onChange={e =>
                            handleQuantityChange(item.id, e.target.value)
                          }
                          className="h-8 text-right text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                    <div>
                      <div>差异数量</div>
                      <div className={`mt-0.5 font-medium ${diffClass}`}>
                        {diffText}
                      </div>
                    </div>
                    {hasFinancePermission && (
                      <div>
                        <div>差异金额</div>
                        <div
                          className={`mt-0.5 font-medium ${
                            totalCost && totalCost !== 0
                              ? totalCost > 0
                                ? 'text-green-600'
                                : 'text-red-600'
                              : ''
                          }`}
                        >
                          {formatNumber(totalCost)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

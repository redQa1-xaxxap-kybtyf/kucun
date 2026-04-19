'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle, Save } from 'lucide-react';
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { queryKeys } from '@/lib/queryKeys';
import {
  COUNT_ITEM_STATUS_LABELS,
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  type CountItemStatus,
  type InventoryCountDetail,
  type InventoryCountItem,
} from '@/lib/types/inventory-count';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import {
  compareInventoryCountItems,
  getInventoryCountItemPiecesPerUnit,
  getInventoryCountItemSpecification,
  matchesInventoryCountItemSearch,
} from '@/lib/utils/inventory-count-item';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';

interface ExecuteCountPageClientProps {
  countId: string;
  initialData: InventoryCountDetail;
  hasFinancePermission: boolean;
}

interface ItemQuantity {
  id: string;
  actualQuantity: number;
}

type QuickFilter = 'all' | 'pending' | 'difference';

function createQuantityMap(items: InventoryCountItem[] | undefined) {
  const next: Record<string, number | null> = {};
  items?.forEach(item => {
    next[item.id] = item.actualQuantity ?? null;
  });
  return next;
}

function isNonNegativeIntegerInput(value: string) {
  return value === '' || /^\d+$/.test(value);
}

function getQuantityParts(
  totalPieces: number | null | undefined,
  piecesPerUnit: number
) {
  if (totalPieces === null || totalPieces === undefined) {
    return { units: '', pieces: '' };
  }

  const normalized = Math.max(0, Math.floor(totalPieces));

  if (piecesPerUnit <= 1) {
    return { units: '', pieces: String(normalized) };
  }

  return {
    units: String(Math.floor(normalized / piecesPerUnit)),
    pieces: String(normalized % piecesPerUnit),
  };
}

function composeCompositeQuantity(
  unitsInput: string,
  piecesInput: string,
  piecesPerUnit: number
) {
  if (!unitsInput && !piecesInput) {
    return null;
  }

  const safePiecesPerUnit = Math.max(1, piecesPerUnit);
  const units = unitsInput ? Number.parseInt(unitsInput, 10) : 0;
  const pieces = piecesInput ? Number.parseInt(piecesInput, 10) : 0;

  if (!Number.isFinite(units) || !Number.isFinite(pieces)) {
    return null;
  }

  const carryUnits = Math.floor(pieces / safePiecesPerUnit);
  const remainingPieces = pieces % safePiecesPerUnit;

  return (units + carryUnits) * safePiecesPerUnit + remainingPieces;
}

function formatQuantitySummary(
  totalPieces: number | null | undefined,
  piecesPerUnit: number
) {
  if (totalPieces === null || totalPieces === undefined) {
    return '未录入';
  }

  const normalized = Math.max(0, Math.floor(totalPieces));

  if (piecesPerUnit <= 1) {
    return `${normalized}片`;
  }

  const result = calculatePieceDisplay(normalized, piecesPerUnit);
  if (result.displayText === `${normalized}片`) {
    return `${normalized}片`;
  }

  return `${normalized}片（${result.displayText}）`;
}

function formatDifferenceSummary(
  difference: number | null | undefined,
  piecesPerUnit: number
) {
  if (difference === null || difference === undefined) {
    return '-';
  }

  const abs = Math.abs(difference);
  const sign = difference > 0 ? '+' : difference < 0 ? '-' : '';
  const body = formatQuantitySummary(abs, piecesPerUnit);
  return sign ? `${sign}${body}` : body;
}

function getStatusBadgeVariant(status: CountItemStatus) {
  const variants: Record<CountItemStatus, 'default' | 'secondary' | 'outline'> =
    {
      pending: 'outline',
      counted: 'default',
      adjusted: 'secondary',
    };
  return variants[status];
}

export function ExecuteCountPageClient({
  countId,
  initialData,
  hasFinancePermission,
}: ExecuteCountPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initialQuantities = React.useMemo(
    () => createQuantityMap(initialData.items),
    [initialData.items]
  );

  const [savedQuantities, setSavedQuantities] =
    React.useState(initialQuantities);
  const [quantities, setQuantities] = React.useState(initialQuantities);
  const [keyword, setKeyword] = React.useState('');
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>('all');

  React.useEffect(() => {
    const nextQuantities = createQuantityMap(initialData.items);
    setSavedQuantities(nextQuantities);
    setQuantities(nextQuantities);
  }, [initialData.items]);

  const calculateDifference = React.useCallback(
    (item: InventoryCountItem) => {
      const actualQty = quantities[item.id];
      if (actualQty === null || actualQty === undefined) return null;
      return actualQty - item.systemQuantity;
    },
    [quantities]
  );

  const calculateTotalCost = React.useCallback(
    (item: InventoryCountItem) => {
      if (!hasFinancePermission) {
        return null;
      }
      const diff = calculateDifference(item);
      if (diff === null || !item.unitCost) return null;
      return diff * item.unitCost;
    },
    [calculateDifference, hasFinancePermission]
  );

  const sortedItems = React.useMemo(
    () => [...(initialData.items ?? [])].sort(compareInventoryCountItems),
    [initialData.items]
  );

  const pendingCount = React.useMemo(
    () =>
      sortedItems.filter(item => {
        const value = quantities[item.id];
        return value === null || value === undefined;
      }).length,
    [quantities, sortedItems]
  );

  const differenceCount = React.useMemo(
    () =>
      sortedItems.filter(item => {
        const diff = calculateDifference(item);
        return diff !== null && diff !== 0;
      }).length,
    [calculateDifference, sortedItems]
  );

  const filteredItems = React.useMemo(
    () =>
      sortedItems.filter(item => {
        if (!matchesInventoryCountItemSearch(item, keyword)) {
          return false;
        }

        if (quickFilter === 'pending') {
          const value = quantities[item.id];
          return value === null || value === undefined;
        }

        if (quickFilter === 'difference') {
          const diff = calculateDifference(item);
          return diff !== null && diff !== 0;
        }

        return true;
      }),
    [calculateDifference, keyword, quantities, quickFilter, sortedItems]
  );

  const hasUnsavedChanges = React.useMemo(
    () =>
      sortedItems.some(
        item =>
          (savedQuantities[item.id] ?? null) !== (quantities[item.id] ?? null)
      ),
    [quantities, savedQuantities, sortedItems]
  );

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
        const errorMessage = errorData.error || errorData.message || '';
        const details = errorData.details || '';

        let userMessage = '保存盘点数据失败';
        if (
          errorMessage.includes('负数') ||
          errorMessage.includes('negative')
        ) {
          userMessage = '保存失败：实盘数量不能为负数，请检查后重试';
        } else if (errorMessage.includes('权限') || response.status === 403) {
          userMessage = '保存失败：您没有执行此操作的权限，请联系管理员';
        } else if (errorMessage.includes('不存在') || response.status === 404) {
          userMessage = '保存失败：盘点单不存在或已被删除，请刷新页面后重试';
        } else if (
          errorMessage.includes('状态') ||
          errorMessage.includes('status')
        ) {
          userMessage = '保存失败：盘点单状态已变更，请刷新页面查看最新状态';
        } else if (errorMessage) {
          userMessage = `保存失败：${errorMessage}${details ? `（${details}）` : ''}`;
        } else {
          userMessage = '保存失败：服务器暂时无法处理请求，请稍后重试';
        }

        throw new Error(userMessage);
      }

      return response.json();
    },
    onSuccess: (_result, variables) => {
      setSavedQuantities(prev => {
        const next = { ...prev };
        variables.forEach(item => {
          next[item.id] = item.actualQuantity;
        });
        return next;
      });

      toast({
        title: '保存成功',
        description: '盘点数据已成功保存',
      });

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
        title: '保存失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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

        let userMessage = '完成盘点失败';
        if (
          errorMessage.includes('未录入') ||
          errorMessage.includes('pending')
        ) {
          userMessage = '完成失败：仍有明细未录入实盘数量，请先完成录入';
        } else if (errorMessage.includes('权限') || response.status === 403) {
          userMessage = '完成失败：您没有执行此操作的权限，请联系管理员';
        } else if (
          errorMessage.includes('状态') ||
          errorMessage.includes('status')
        ) {
          userMessage = '完成失败：盘点单状态已变更，请刷新页面查看最新状态';
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
        description: '盘点单已完成',
      });

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

  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled:
      hasUnsavedChanges &&
      !submitMutation.isPending &&
      !completeMutation.isPending,
    message: '当前盘点数据尚未保存，确定要离开吗？',
  });

  const handlePieceQuantityChange = (itemId: string, value: string) => {
    if (!isNonNegativeIntegerInput(value)) {
      return;
    }

    setQuantities(prev => ({
      ...prev,
      [itemId]: value === '' ? null : Number.parseInt(value, 10),
    }));
  };

  const handleCompositeQuantityChange = (
    item: InventoryCountItem,
    field: 'units' | 'pieces',
    value: string
  ) => {
    if (!isNonNegativeIntegerInput(value)) {
      return;
    }

    const piecesPerUnit = getInventoryCountItemPiecesPerUnit(item);
    const currentParts = getQuantityParts(quantities[item.id], piecesPerUnit);
    const nextQuantity = composeCompositeQuantity(
      field === 'units' ? value : currentParts.units,
      field === 'pieces' ? value : currentParts.pieces,
      piecesPerUnit
    );

    setQuantities(prev => ({
      ...prev,
      [item.id]: nextQuantity,
    }));
  };

  const handleSetSystemQuantity = () => {
    const nextQuantities: Record<string, number | null> = {};
    initialData.items?.forEach(item => {
      nextQuantities[item.id] = item.systemQuantity;
    });
    setQuantities(nextQuantities);
  };

  const handleClearQuantities = () => {
    const nextQuantities: Record<string, number | null> = {};
    initialData.items?.forEach(item => {
      nextQuantities[item.id] = null;
    });
    setQuantities(nextQuantities);
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
        title: '保存失败',
        description: '请至少录入一条实盘数量',
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate(data);
  };

  const handleComplete = () => {
    if (hasUnsavedChanges) {
      toast({
        title: '请先保存',
        description: '当前有未保存的实盘数量，请先保存后再完成盘点',
        variant: 'destructive',
      });
      return;
    }

    completeMutation.mutate();
  };

  const formatAmount = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const renderQuantityEditor = (
    item: InventoryCountItem,
    compact: boolean = false
  ) => {
    const piecesPerUnit = getInventoryCountItemPiecesPerUnit(item);
    const currentValue = quantities[item.id];
    const quantityText = formatQuantitySummary(currentValue, piecesPerUnit);

    if (piecesPerUnit <= 1) {
      return (
        <div
          className={compact ? 'space-y-1' : 'flex flex-col items-end gap-1'}
        >
          <Input
            type="number"
            step="1"
            min="0"
            inputMode="numeric"
            value={currentValue ?? ''}
            onChange={event =>
              handlePieceQuantityChange(item.id, event.target.value)
            }
            className={
              compact ? 'h-8 text-right text-xs' : 'h-8 w-28 text-right'
            }
          />
          <div className="text-muted-foreground text-xs">
            {currentValue === null || currentValue === undefined
              ? '未录入'
              : quantityText}
          </div>
        </div>
      );
    }

    const parts = getQuantityParts(currentValue, piecesPerUnit);

    return (
      <div className={compact ? 'space-y-2' : 'flex flex-col items-end gap-1'}>
        <div
          className={
            compact ? 'grid grid-cols-2 gap-2' : 'flex justify-end gap-2'
          }
        >
          <label className="flex items-center gap-1">
            <Input
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              value={parts.units}
              onChange={event =>
                handleCompositeQuantityChange(item, 'units', event.target.value)
              }
              className={
                compact ? 'h-8 text-right text-xs' : 'h-8 w-20 text-right'
              }
            />
            <span className="text-muted-foreground text-xs">件</span>
          </label>
          <label className="flex items-center gap-1">
            <Input
              type="number"
              step="1"
              min="0"
              inputMode="numeric"
              value={parts.pieces}
              onChange={event =>
                handleCompositeQuantityChange(
                  item,
                  'pieces',
                  event.target.value
                )
              }
              className={
                compact ? 'h-8 text-right text-xs' : 'h-8 w-20 text-right'
              }
            />
            <span className="text-muted-foreground text-xs">片</span>
          </label>
        </div>
        <div className="text-muted-foreground text-xs">
          {currentValue === null || currentValue === undefined
            ? '未录入'
            : quantityText}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link
              href={`/inventory/counts/${countId}`}
              onClick={event => {
                if (!confirmLeavePage()) {
                  event.preventDefault();
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">录入盘点结果</h1>
            <p className="text-muted-foreground">{initialData.countNumber}</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:justify-end">
          <Button
            variant="outline"
            onClick={handleSubmit}
            disabled={submitMutation.isPending || completeMutation.isPending}
            className="w-full xl:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            保存盘点数据
          </Button>
          <Button
            onClick={handleComplete}
            disabled={submitMutation.isPending || completeMutation.isPending}
            className="w-full xl:w-auto"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            完成盘点
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div>
              <div className="text-muted-foreground text-sm">盘点单名称</div>
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
            <div>
              <div className="text-muted-foreground text-sm">库位/存放区域</div>
              <div className="font-medium">
                {initialData.location || '全部库存'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>盘点明细</CardTitle>
              <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSetSystemQuantity}
                  className="w-full xl:w-auto"
                >
                  一键带出账面数
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearQuantities}
                  className="w-full xl:w-auto"
                >
                  清空实盘数
                </Button>
              </div>
            </div>
            <div className="bg-muted/20 rounded-lg border p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Input
                  value={keyword}
                  onChange={event => setKeyword(event.target.value)}
                  placeholder="搜索产品名称、产品编码或批次号"
                  className="lg:max-w-md"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setQuickFilter('all')}
                  >
                    全部 {sortedItems.length}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={quickFilter === 'pending' ? 'default' : 'outline'}
                    onClick={() => setQuickFilter('pending')}
                  >
                    仅看未录入 {pendingCount}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      quickFilter === 'difference' ? 'default' : 'outline'
                    }
                    onClick={() => setQuickFilter('difference')}
                  >
                    仅看有差异 {differenceCount}
                  </Button>
                </div>
              </div>
              <div className="text-muted-foreground mt-2 text-xs">
                共 {sortedItems.length} 条盘点明细，当前显示{' '}
                {filteredItems.length} 条。
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredItems.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed py-10 text-center">
              当前筛选条件下没有找到盘点明细。
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-md border lg:block">
                <Table className="min-w-[1320px] [&_th]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        产品编码
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        产品名称
                      </TableHead>
                      <TableHead className="whitespace-nowrap">
                        规格
                      </TableHead>
                      <TableHead className="text-right">包装信息</TableHead>
                      <TableHead className="whitespace-nowrap">批次号</TableHead>
                      <TableHead className="text-right">账面数量</TableHead>
                      <TableHead className="text-right">实盘数量</TableHead>
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
                    {filteredItems.map(item => {
                      const difference = calculateDifference(item);
                      const totalCost = calculateTotalCost(item);
                      const piecesPerUnit =
                        getInventoryCountItemPiecesPerUnit(item);

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {item.product?.code || '-'}
                          </TableCell>
                          <TableCell className="min-w-[180px]">
                            <div className="max-w-[220px] truncate">
                              {item.product?.name || '-'}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {getInventoryCountItemSpecification(item)}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {piecesPerUnit > 0 ? `${piecesPerUnit}片/件` : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {item.batchNumber || '-'}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {formatQuantitySummary(
                              item.systemQuantity,
                              piecesPerUnit
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {renderQuantityEditor(item)}
                          </TableCell>
                          <TableCell
                            className={`text-right whitespace-nowrap ${
                              difference !== null && difference !== 0
                                ? difference > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                                : ''
                            }`}
                          >
                            {formatDifferenceSummary(difference, piecesPerUnit)}
                          </TableCell>
                          {hasFinancePermission && (
                            <>
                              <TableCell className="text-right whitespace-nowrap">
                                {formatCostPrice(item.unitCost, {
                                  withSymbol: false,
                                  fallback: '-',
                                })}
                              </TableCell>
                              <TableCell
                                className={`text-right whitespace-nowrap ${
                                  totalCost !== null && totalCost !== 0
                                    ? totalCost > 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                    : ''
                                }`}
                              >
                                {formatAmount(totalCost)}
                              </TableCell>
                            </>
                          )}
                          <TableCell className="whitespace-nowrap">
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

              <div className="space-y-3 lg:hidden">
                {filteredItems.map(item => {
                  const difference = calculateDifference(item);
                  const totalCost = calculateTotalCost(item);
                  const piecesPerUnit =
                    getInventoryCountItemPiecesPerUnit(item);

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
                            {getInventoryCountItemSpecification(item) || '-'}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                            <span>批次号：{item.batchNumber || '-'}</span>
                            <span>
                              包装：
                              {piecesPerUnit > 0
                                ? `${piecesPerUnit}片/件`
                                : '-'}
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                          <Badge variant={getStatusBadgeVariant(item.status)}>
                            {COUNT_ITEM_STATUS_LABELS[item.status]}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-2 rounded-xl bg-[hsl(var(--color-bg-secondary))] p-3">
                        <div className="grid grid-cols-1 gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                          <div>
                            <div>账面数量</div>
                            <div className="mt-0.5 font-medium text-[hsl(var(--color-text-primary))]">
                              {formatQuantitySummary(
                                item.systemQuantity,
                                piecesPerUnit
                              )}
                            </div>
                          </div>
                          <div>
                            <div>实盘数量</div>
                            <div className="mt-1">
                              {renderQuantityEditor(item, true)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                        <div>
                          <div>差异数量</div>
                          <div
                            className={`mt-0.5 font-medium ${
                              difference !== null && difference !== 0
                                ? difference > 0
                                  ? 'text-green-600'
                                  : 'text-red-600'
                                : ''
                            }`}
                          >
                            {formatDifferenceSummary(difference, piecesPerUnit)}
                          </div>
                        </div>
                        {hasFinancePermission && (
                          <div>
                            <div>差异金额</div>
                            <div
                              className={`mt-0.5 font-medium ${
                                totalCost !== null && totalCost !== 0
                                  ? totalCost > 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                  : ''
                              }`}
                            >
                              {formatAmount(totalCost)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

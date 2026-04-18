'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import * as React from 'react';

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
import { can } from '@/lib/auth/permissions';
import {
  COUNT_ITEM_STATUS_LABELS,
  type CountItemStatus,
  type InventoryCountItem,
} from '@/lib/types/inventory-count';
import { formatCostPrice } from '@/lib/utils/cost-price';
import {
  compareInventoryCountItems,
  getInventoryCountItemPiecesPerUnit,
  getInventoryCountItemSpecification,
} from '@/lib/utils/inventory-count-item';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface CountItemsTableProps {
  items: InventoryCountItem[];
  isLoading?: boolean;
  showActions?: boolean;
  onEdit?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}

export function CountItemsTable({
  items,
  isLoading,
  showActions = false,
  onEdit,
  onDelete,
}: CountItemsTableProps) {
  const { data: session } = useSession();
  const hasFinancePermission = React.useMemo(
    () => can(session?.user ?? null, 'finance:view'),
    [session?.user]
  );

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

  const formatAmount = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const sortedItems = React.useMemo(
    () => [...items].sort(compareInventoryCountItems),
    [items]
  );

  if (isLoading) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">暂无盘点商品</div>
    );
  }

  return (
    <>
      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto rounded-md border xl:block">
        <Table className="min-w-[1120px] [&_th]:whitespace-nowrap">
          <TableHeader>
            <TableRow>
              <TableHead>商品编号</TableHead>
              <TableHead>商品名称</TableHead>
              <TableHead>规格型号</TableHead>
              <TableHead className="text-right">每件片数</TableHead>
              <TableHead>批次</TableHead>
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
              {showActions && (
                <TableHead className="text-right">操作</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedItems.map(item => (
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
                  {getInventoryCountItemPiecesPerUnit(item) > 0
                    ? `${getInventoryCountItemPiecesPerUnit(item)}片/件`
                    : '-'}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {item.batchNumber || '-'}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {(() => {
                    const ppu = getInventoryCountItemPiecesPerUnit(item);
                    return ppu > 1
                      ? formatPieceSummary(item.systemQuantity, ppu, {
                          fallbackUnit: '片',
                          zeroDisplay: '0片',
                        })
                      : `${item.systemQuantity}片`;
                  })()}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {(() => {
                    if (
                      item.actualQuantity === null ||
                      item.actualQuantity === undefined
                    )
                      return '—';
                    const ppu = getInventoryCountItemPiecesPerUnit(item);
                    return ppu > 1
                      ? formatPieceSummary(item.actualQuantity, ppu, {
                          fallbackUnit: '片',
                          zeroDisplay: '0片',
                        })
                      : `${item.actualQuantity}片`;
                  })()}
                </TableCell>
                <TableCell
                  className={`text-right ${
                    item.difference && item.difference !== 0
                      ? item.difference > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                      : ''
                  }`}
                >
                  {(() => {
                    if (
                      item.difference === null ||
                      item.difference === undefined
                    )
                      return '-';
                    const ppu = getInventoryCountItemPiecesPerUnit(item);
                    const abs = Math.abs(item.difference);
                    const text =
                      ppu > 1
                        ? formatPieceSummary(abs, ppu, {
                            fallbackUnit: '片',
                            zeroDisplay: '0片',
                          })
                        : `${abs}片`;
                    const sign =
                      item.difference > 0
                        ? '+'
                        : item.difference < 0
                          ? '-'
                          : '';
                    return sign ? `${sign}${text}` : text;
                  })()}
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
                      className={`text-right ${
                        item.totalCost && item.totalCost !== 0
                          ? item.totalCost > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                          : ''
                      }`}
                    >
                      {formatAmount(item.totalCost)}
                    </TableCell>
                  </>
                )}
                <TableCell className="whitespace-nowrap">
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {COUNT_ITEM_STATUS_LABELS[item.status]}
                  </Badge>
                </TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {onEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(item.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 xl:hidden">
        {sortedItems.map(item => {
          const ppu = getInventoryCountItemPiecesPerUnit(item);
          const systemDisplay =
            ppu > 1
              ? formatPieceSummary(item.systemQuantity, ppu, {
                  fallbackUnit: '片',
                  zeroDisplay: '0片',
                })
              : `${item.systemQuantity}片`;

          const actualDisplay =
            item.actualQuantity === null || item.actualQuantity === undefined
              ? '—'
              : ppu > 1
                ? formatPieceSummary(item.actualQuantity, ppu, {
                    fallbackUnit: '片',
                    zeroDisplay: '0片',
                  })
                : `${item.actualQuantity}片`;

          let diffClass = '';
          let diffText = '-';
          if (item.difference !== null && item.difference !== undefined) {
            const abs = Math.abs(item.difference);
            const baseText =
              ppu > 1
                ? formatPieceSummary(abs, ppu, {
                    fallbackUnit: '片',
                    zeroDisplay: '0片',
                  })
                : `${abs}片`;
            const sign =
              item.difference > 0 ? '+' : item.difference < 0 ? '-' : '';
            diffText = sign ? `${sign}${baseText}` : baseText;
            if (item.difference > 0) diffClass = 'text-green-600';
            else if (item.difference < 0) diffClass = 'text-red-600';
          }

          return (
            <div
              key={item.id}
              className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {item.product?.code || '-'}
                  </div>
                  <div className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    {item.product?.name || '-'}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    {getInventoryCountItemSpecification(item)}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    批次：{item.batchNumber || '-'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {COUNT_ITEM_STATUS_LABELS[item.status]}
                  </Badge>
                  {hasFinancePermission && (
                    <div className="mt-2 space-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      <div>
                        单位成本：
                        {formatCostPrice(item.unitCost, {
                          withSymbol: false,
                          fallback: '-',
                        })}
                      </div>
                      <div
                        className={
                          item.totalCost && item.totalCost !== 0
                            ? item.totalCost > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                            : ''
                        }
                      >
                        差异金额：{formatAmount(item.totalCost)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[hsl(var(--color-text-secondary))]">
                <div>
                  <div>账面数量</div>
                  <div className="mt-0.5 font-medium text-[hsl(var(--color-text-primary))]">
                    {systemDisplay}
                  </div>
                </div>
                <div>
                  <div>实盘数量</div>
                  <div className="mt-0.5 font-medium text-[hsl(var(--color-text-primary))]">
                    {actualDisplay}
                  </div>
                </div>
                <div>
                  <div>差异数量</div>
                  <div className={`mt-0.5 font-medium ${diffClass}`}>
                    {diffText}
                  </div>
                </div>
              </div>

              {showActions && (
                <div className="mt-3 flex justify-end gap-2">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item.id)}
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      编辑
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      删除
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

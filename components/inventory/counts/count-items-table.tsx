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

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  if (isLoading) {
    return <div className="py-8 text-center">加载中...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">暂无盘点明细</div>
    );
  }

  return (
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
            {showActions && <TableHead className="text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(item => (
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
                {(() => {
                  const ppu = item.product?.piecesPerUnit ?? 0;
                  return ppu > 0
                    ? formatPieceSummary(item.systemQuantity, ppu, {
                        fallbackUnit: '片',
                        zeroDisplay: '0片',
                      })
                    : `${item.systemQuantity}片`;
                })()}
              </TableCell>
              <TableCell className="text-right">
                {(() => {
                  if (
                    item.actualQuantity === null ||
                    item.actualQuantity === undefined
                  )
                    return '—';
                  const ppu = item.product?.piecesPerUnit ?? 0;
                  return ppu > 0
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
                  if (item.difference === null || item.difference === undefined)
                    return '-';
                  const ppu = item.product?.piecesPerUnit ?? 0;
                  const abs = Math.abs(item.difference);
                  const text =
                    ppu > 0
                      ? formatPieceSummary(abs, ppu, {
                          fallbackUnit: '片',
                          zeroDisplay: '0片',
                        })
                      : `${abs}片`;
                  const sign =
                    item.difference > 0 ? '+' : item.difference < 0 ? '-' : '';
                  return sign ? `${sign}${text}` : text;
                })()}
              </TableCell>
              {hasFinancePermission && (
                <>
                  <TableCell className="text-right">
                    {formatNumber(item.unitCost)}
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
                    {formatNumber(item.totalCost)}
                  </TableCell>
                </>
              )}
              <TableCell>
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
  );
}

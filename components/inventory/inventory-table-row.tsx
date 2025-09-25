/**
 * 库存表格行组件
 * 使用React.memo优化渲染性能
 */

'use client';

import { Edit } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

interface InventoryTableRowProps {
  item: Inventory;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
}

/**
 * 库存状态判断
 */
const getStockStatus = (quantity: number, minStock: number = 10) => {
  if (quantity <= 0) {
    return {
      status: 'out',
      label: '缺货',
      variant: 'destructive' as const,
      color: 'text-red-600',
    };
  } else if (quantity <= minStock) {
    return {
      status: 'low',
      label: '库存不足',
      variant: 'secondary' as const,
      color: 'text-yellow-600',
    };
  } else {
    return {
      status: 'normal',
      label: '正常',
      variant: 'default' as const,
      color: 'text-green-600',
    };
  }
};

/**
 * 库存状态标签渲染
 */
const getStockBadge = (quantity: number, minStock?: number) => {
  const { label, variant } = getStockStatus(quantity, minStock);
  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
};

/**
 * 格式化库存数量显示
 */
const formatQuantityDisplay = (item: Inventory) => {
  if (!item.product?.piecesPerUnit) {
    const unit = item.product?.unit
      ? PRODUCT_UNIT_LABELS[
          item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
        ] || item.product.unit
      : '件';
    return `${item.quantity} ${unit}`;
  }
  return formatInventoryQuantity(item.quantity, item.product, true);
};

/**
 * 库存表格行组件
 * 使用React.memo优化重渲染性能
 */
export const InventoryTableRow = React.memo<InventoryTableRowProps>(
  ({ item, isSelected, onSelect, onAdjust }) => {
    // 优化的事件处理函数
    const handleSelect = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onSelect(item.id, e.target.checked);
      },
      [item.id, onSelect]
    );

    const handleAdjust = React.useCallback(() => {
      onAdjust(item.id);
    }, [item.id, onAdjust]);

    // 使用useMemo优化计算密集型操作
    const quantityDisplay = React.useMemo(
      () => formatQuantityDisplay(item),
      [item]
    );

    const stockBadge = React.useMemo(
      () => getStockBadge(item.quantity, 10),
      [item.quantity]
    );

    const availableQuantity = React.useMemo(
      () => item.quantity - (item.reservedQuantity || 0),
      [item.quantity, item.reservedQuantity]
    );

    const formattedDate = React.useMemo(
      () => new Date(item.updatedAt).toLocaleDateString('zh-CN'),
      [item.updatedAt]
    );

    return (
      <TableRow className="text-xs">
        <TableCell>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleSelect}
            className="rounded border border-input"
          />
        </TableCell>
        <TableCell className="font-mono">
          {item.product?.code || '-'}
        </TableCell>
        <TableCell className="font-medium">
          {item.product?.name || '-'}
        </TableCell>
        <TableCell>{item.product?.specification || '-'}</TableCell>
        <TableCell className="font-mono">
          {item.batchNumber || '-'}
        </TableCell>
        <TableCell className="font-medium">
          {quantityDisplay}
        </TableCell>
        <TableCell>{item.reservedQuantity || 0}</TableCell>
        <TableCell className="font-medium">
          {availableQuantity}
        </TableCell>
        <TableCell>{stockBadge}</TableCell>
        <TableCell>{formattedDate}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleAdjust}
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }
);

InventoryTableRow.displayName = 'InventoryTableRow';

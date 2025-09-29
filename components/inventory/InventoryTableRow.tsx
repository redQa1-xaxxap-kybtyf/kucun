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
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';

interface InventoryTableRowProps {
  item: Inventory;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
}

/**
 * 库存状态标签渲染
 * 使用统一的库存状态判断逻辑
 */
const getStockBadge = (quantity: number, reservedQuantity: number = 0) => {
  const { label, variant } = getInventoryStatus(quantity, reservedQuantity);
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
      () => getStockBadge(item.quantity, item.reservedQuantity || 0),
      [item.quantity, item.reservedQuantity]
    );

    // 格式化规格显示（限制11个字符，避免JSON字符串显示）
    const formattedSpecification = React.useMemo(() => {
      const spec = item.product?.specification;
      if (!spec) return '-';

      // 如果是JSON字符串，尝试解析并提取关键信息
      if (spec.startsWith('{') && spec.endsWith('}')) {
        try {
          const parsed = JSON.parse(spec);
          // 提取尺寸信息作为主要显示内容
          if (parsed.size) {
            return parsed.size.length > 11
              ? `${parsed.size.slice(0, 11)}...`
              : parsed.size;
          }
          // 如果没有尺寸，显示简化的规格信息
          return '规格详情...';
        } catch {
          // JSON解析失败，截断显示
          return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
        }
      }

      // 普通字符串，直接截断
      return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
    }, [item.product?.specification]);

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
        <TableCell className="font-mono">{item.product?.code || '-'}</TableCell>
        <TableCell className="font-medium">
          {item.product?.name || '-'}
        </TableCell>
        <TableCell>{formattedSpecification}</TableCell>
        <TableCell className="font-mono">{item.batchNumber || '-'}</TableCell>
        <TableCell className="font-medium">{quantityDisplay}</TableCell>
        <TableCell>{item.reservedQuantity || 0}</TableCell>
        <TableCell className="font-medium">{availableQuantity}</TableCell>
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

/**
 * 库存表格行组件
 * 使用React.memo优化渲染性能
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { Eye, MoreHorizontal } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableCell, TableRow } from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryTableRowProps {
  item: Inventory;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
  /** 自定义样式（用于虚拟化） */
  style?: React.CSSProperties;
  /** 自定义类名 */
  className?: string;
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

function useInventoryRowHandlers(
  item: Inventory,
  onSelect: (id: string, checked: boolean) => void,
  onAdjust: (id: string) => void
) {
  const handleSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSelect(item.id, e.target.checked);
    },
    [item.id, onSelect]
  );

  const handleAdjust = React.useCallback(() => {
    if (!item.batchNumber) {
      return;
    }
    onAdjust(item.id);
  }, [item.batchNumber, item.id, onAdjust]);

  return { handleSelect, handleAdjust };
}

function useInventoryRowData(item: Inventory) {
  const unitLabel = React.useMemo(() => {
    if (!item.product?.unit) {
      return '件';
    }

    return (
      PRODUCT_UNIT_LABELS[
        item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
      ] || item.product.unit
    );
  }, [item.product?.unit]);

  const packaging = React.useMemo(
    () => item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0,
    [item.batchPiecesPerUnit, item.product?.piecesPerUnit]
  );

  const quantityDisplay = React.useMemo(
    () =>
      formatPieceSummary(item.quantity, packaging, {
        prefix: '总计',
        fallbackUnit: unitLabel,
      }),
    [item.quantity, packaging, unitLabel]
  );

  const stockBadge = React.useMemo(
    () => getStockBadge(item.quantity, item.reservedQuantity || 0),
    [item.quantity, item.reservedQuantity]
  );

  const formattedSpecification = React.useMemo(() => {
    const spec = item.product?.specification;
    if (!spec) {
      return '-';
    }

    if (spec.startsWith('{') && spec.endsWith('}')) {
      try {
        const parsed = JSON.parse(spec);
        if (parsed.size) {
          return parsed.size.length > 11
            ? `${parsed.size.slice(0, 11)}...`
            : parsed.size;
        }
        return '规格详情...';
      } catch {
        return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
      }
    }

    return spec.length > 11 ? `${spec.slice(0, 11)}...` : spec;
  }, [item.product?.specification]);

  const reservedDisplay = React.useMemo(() => {
    const reserved = item.reservedQuantity || 0;
    if (reserved === 0) {
      return '0';
    }

    return formatPieceSummary(reserved, packaging, {
      fallbackUnit: unitLabel,
      zeroDisplay: '0',
    });
  }, [item.reservedQuantity, packaging, unitLabel]);

  const availableDisplay = React.useMemo(() => {
    const availableQuantity = item.quantity - (item.reservedQuantity || 0);
    if (availableQuantity <= 0) {
      return '0';
    }

    return formatPieceSummary(availableQuantity, packaging, {
      fallbackUnit: unitLabel,
      zeroDisplay: '0',
    });
  }, [item.quantity, item.reservedQuantity, packaging, unitLabel]);

  const formattedDate = React.useMemo(
    () => new Date(item.updatedAt).toLocaleDateString('zh-CN'),
    [item.updatedAt]
  );

  return {
    packaging,
    quantityDisplay,
    stockBadge,
    formattedSpecification,
    reservedDisplay,
    availableDisplay,
    formattedDate,
  };
}

interface InventoryRowViewProps {
  item: Inventory;
  isSelected: boolean;
  onSelect: React.ChangeEventHandler<HTMLInputElement>;
  onAdjust: () => void;
  style?: React.CSSProperties;
  className?: string;
  packaging: number;
  quantityDisplay: string;
  reservedDisplay: string;
  availableDisplay: string;
  stockBadge: React.ReactNode;
  formattedSpecification: string;
  formattedDate: string;
}

function InventoryRowView({
  item,
  isSelected,
  onSelect,
  onAdjust,
  style,
  className,
  packaging,
  quantityDisplay,
  reservedDisplay,
  availableDisplay,
  stockBadge,
  formattedSpecification,
  formattedDate,
}: InventoryRowViewProps) {
  return (
    <TableRow
      className={`text-xs transition-colors hover:bg-blue-50/50 ${className || ''}`}
      style={style}
    >
      <TableCell>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="border-input rounded border"
        />
      </TableCell>
      <TableCell className="font-medium text-blue-600">
        {item.product?.code || '-'}
      </TableCell>
      <TableCell className="font-medium">{item.product?.name || '-'}</TableCell>
      <TableCell>{formattedSpecification}</TableCell>
      <TableCell className="font-medium">
        {packaging > 0 ? (
          <>
            {packaging}
            <span className="ml-0.5 text-[10px] font-normal text-[hsl(var(--color-text-tertiary))]">
              片/件
            </span>
          </>
        ) : (
          <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
        )}
      </TableCell>
      <TableCell className="font-mono">{item.batchNumber || '-'}</TableCell>
      <TableCell className="font-medium">{quantityDisplay}</TableCell>
      <TableCell>{reservedDisplay}</TableCell>
      <TableCell className="font-medium">{availableDisplay}</TableCell>
      <TableCell>{stockBadge}</TableCell>
      <TableCell>{formattedDate}</TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAdjust} disabled={!item.batchNumber}>
              <Eye className="mr-2 h-4 w-4" />
              查看库存变动详情
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/**
 * 库存表格行组件
 * 使用React.memo优化重渲染性能
 */
export const InventoryTableRow = React.memo<InventoryTableRowProps>(
  ({ item, isSelected, onSelect, onAdjust, style, className }) => {
    const { handleSelect, handleAdjust } = useInventoryRowHandlers(
      item,
      onSelect,
      onAdjust
    );
    const rowData = useInventoryRowData(item);

    return (
      <InventoryRowView
        item={item}
        isSelected={isSelected}
        onSelect={handleSelect}
        onAdjust={handleAdjust}
        style={style}
        className={className}
        {...rowData}
      />
    );
  }
);

InventoryTableRow.displayName = 'InventoryTableRow';

/**
 * 库存表格行组件
 * 使用React.memo优化渲染性能
 * ✅ 符合产品模块UI风格规范
 */

'use client';

import { Eye, ImageIcon, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
import { RelativeTime } from '@/components/common/relative-time';
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
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryTableRowProps {
  item: Inventory;
  onAdjust: (id: string) => void;
  /** 是否有财务查看权限 */
  hasFinancePermission?: boolean;
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
    <Badge
      variant={variant}
      className={`text-xs font-medium ${
        variant === 'destructive' || variant === 'warning'
          ? 'animate-breathe'
          : ''
      }`}
    >
      {label}
    </Badge>
  );
};

function useInventoryRowHandlers(
  item: Inventory,
  onAdjust: (id: string) => void
) {
  const handleAdjust = React.useCallback(() => {
    if (!item.batchNumber) {
      return;
    }
    onAdjust(item.id);
  }, [item.batchNumber, item.id, onAdjust]);

  return { handleAdjust };
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

  const formattedDate = React.useMemo(() => {
    const formatted = formatDateTime(item.updatedAt);
    return formatted ? formatted : '-';
  }, [item.updatedAt]);

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
  onAdjust: () => void;
  hasFinancePermission?: boolean;
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
  onAdjust,
  hasFinancePermission = false,
  style,
  className,
  packaging,
  quantityDisplay,
  reservedDisplay,
  availableDisplay,
  stockBadge,
  formattedSpecification,
  formattedDate: _formattedDate,
}: InventoryRowViewProps) {
  return (
    <TableRow
      className={`even:bg-muted/20 cursor-pointer text-xs hover:bg-[hsl(var(--color-primary-light))] ${className || ''}`}
      style={style}
      onDoubleClick={onAdjust}
    >
      {/* 产品缩略图 */}
      <TableCell className="hidden w-12 2xl:table-cell">
        {item.product?.thumbnailUrl ? (
          <div className="relative h-10 w-10 overflow-hidden rounded border border-[hsl(var(--color-border-secondary))] bg-white">
            <Image
              src={item.product.thumbnailUrl}
              alt={item.product.name || '产品'}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]">
            <ImageIcon className="h-4 w-4 text-[hsl(var(--color-text-tertiary))]" />
          </div>
        )}
      </TableCell>
      <TableCell className="font-medium whitespace-nowrap text-[hsl(var(--color-primary))]">
        {item.product?.code ? <CopyableText text={item.product.code} /> : '-'}
      </TableCell>
      <TableCell className="max-w-[180px] truncate font-medium 2xl:max-w-[260px]">
        {item.product?.name || '-'}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {formattedSpecification}
      </TableCell>
      <TableCell className="hidden font-medium whitespace-nowrap 2xl:table-cell">
        <div className="flex flex-col gap-0.5">
          {packaging > 0 ? (
            <>
              {packaging}
              <span className="ml-1 text-xs font-bold text-slate-500">
                片/件
              </span>
            </>
          ) : (
            <span className="text-[hsl(var(--color-text-tertiary))]">-</span>
          )}
          {item.weight ? (
            <span className="text-xs font-bold text-slate-500 tabular-nums">
              {item.weight.toFixed(2)}
              <span className="ml-1 font-bold text-slate-400">kg</span>
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="font-mono whitespace-nowrap">
        {item.batchNumber ? <CopyableText text={item.batchNumber} /> : '-'}
      </TableCell>
      <TableCell className="text-right font-semibold whitespace-nowrap text-[hsl(var(--color-success))] tabular-nums">
        {quantityDisplay}
      </TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap text-[hsl(var(--color-warning))] tabular-nums">
        {reservedDisplay}
      </TableCell>
      <TableCell className="text-right font-medium whitespace-nowrap text-[hsl(var(--color-primary))] tabular-nums">
        {availableDisplay}
      </TableCell>
      {/* 成本信息（仅财务权限可见）- 合并显示 */}
      {hasFinancePermission && (
        <TableCell className="hidden text-right whitespace-nowrap tabular-nums 2xl:table-cell">
          {item.unitCost !== null && item.unitCost !== undefined ? (
            <div className="space-y-0.5">
              <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                {formatCostPrice(item.unitCost)}
              </div>
              <div className="font-semibold text-[hsl(var(--color-primary))]">
                {formatCurrency(item.quantity * item.unitCost)}
              </div>
            </div>
          ) : (
            '-'
          )}
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">{stockBadge}</TableCell>
      <TableCell className="hidden text-xs whitespace-nowrap 2xl:table-cell">
        <RelativeTime date={item.updatedAt} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-md p-0 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
            >
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
  ({ item, onAdjust, hasFinancePermission = false, style, className }) => {
    const { handleAdjust } = useInventoryRowHandlers(item, onAdjust);
    const rowData = useInventoryRowData(item);

    return (
      <InventoryRowView
        item={item}
        onAdjust={handleAdjust}
        hasFinancePermission={hasFinancePermission}
        style={style}
        className={className}
        {...rowData}
      />
    );
  }
);

InventoryTableRow.displayName = 'InventoryTableRow';

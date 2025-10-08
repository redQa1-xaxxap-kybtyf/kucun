/**
 * 库存分组表格组件 - 支持合并单元格
 * 相同产品编码的记录会合并产品信息列，批次信息独立显示
 */

'use client';

import { Edit, Package } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Inventory } from '@/lib/types/inventory';
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { formatInventoryQuantity } from '@/lib/utils/piece-calculation';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';

interface InventoryGroupedTableProps {
  data: Inventory[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  canSelectAll: boolean;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onAdjust: (id: string) => void;
}

interface ProductGroup {
  productCode: string;
  productName: string;
  specification: string;
  items: Inventory[];
  totalPieces: number; // 总片数
  totalUnits: number; // 总件数
  piecesPerUnit: number; // 每件片数（用于计算）
}

/**
 * 将库存数据按产品编码分组，并计算总计
 */
function groupByProduct(inventories: Inventory[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>();

  inventories.forEach(inventory => {
    const code = inventory.product?.code || 'UNKNOWN';

    if (!groups.has(code)) {
      groups.set(code, {
        productCode: code,
        productName: inventory.product?.name || '-',
        specification: formatSpecification(inventory.product?.specification),
        items: [inventory],
        totalPieces: 0,
        totalUnits: 0,
        piecesPerUnit: inventory.product?.piecesPerUnit || 1,
      });
    } else {
      groups.get(code)!.items.push(inventory);
    }
  });

  // 计算每个分组的总计
  groups.forEach(group => {
    group.totalPieces = group.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    group.totalUnits = Math.floor(group.totalPieces / group.piecesPerUnit);
  });

  return Array.from(groups.values());
}

/**
 * 格式化规格显示
 */
function formatSpecification(spec: string | null | undefined): string {
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
}

/**
 * 格式化库存数量显示
 */
function formatQuantityDisplay(item: Inventory): string {
  if (!item.product?.piecesPerUnit) {
    const unit = item.product?.unit
      ? PRODUCT_UNIT_LABELS[
          item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
        ] || item.product.unit
      : '件';
    return `${item.quantity} ${unit}`;
  }
  return formatInventoryQuantity(item.quantity, item.product, true);
}

function EmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={10} className="h-32 text-center">
        <div className="text-muted-foreground flex flex-col items-center gap-2">
          <Package className="h-8 w-8" />
          <span className="text-sm">暂无库存数据</span>
        </div>
      </TableCell>
    </TableRow>
  );
}

export const InventoryGroupedTable = React.memo<InventoryGroupedTableProps>(
  ({
    data,
    selectedIds,
    isAllSelected,
    canSelectAll,
    onSelectAll,
    onSelectRow,
    onAdjust,
  }) => {
    const groups = React.useMemo(() => groupByProduct(data), [data]);

    return (
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="sticky top-0 z-20 bg-gray-100 shadow-sm">
          <TableRow className="bg-gray-100">
            <TableHead className="bg-gray-100">产品编码</TableHead>
            <TableHead className="bg-gray-100">产品名称</TableHead>
            <TableHead className="bg-gray-100">规格</TableHead>
            <TableHead className="bg-gray-100">批次号</TableHead>
            <TableHead className="bg-gray-100">库存数量</TableHead>
            <TableHead className="bg-gray-100">预留数量</TableHead>
            <TableHead className="bg-gray-100">可用数量</TableHead>
            <TableHead className="bg-gray-100">库存状态</TableHead>
            <TableHead className="bg-gray-100">最后更新</TableHead>
            <TableHead className="bg-gray-100">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <EmptyState />
          ) : (
            groups.map((group, groupIndex) =>
              group.items.map((item, index) => {
                const isFirstInGroup = index === 0;
                const isLastInGroup = index === group.items.length - 1;
                const availableQuantity =
                  item.quantity - (item.reservedQuantity || 0);
                const { label, variant, color } = getInventoryStatus(
                  item.quantity,
                  item.reservedQuantity || 0
                );
                const formattedDate = new Date(
                  item.updatedAt
                ).toLocaleDateString('zh-CN');
                const quantityDisplay = formatQuantityDisplay(item);
                // 可用数量只显示片数
                const availableQuantityDisplay = `${availableQuantity} 片`;

                return (
                  <TableRow
                    key={item.id}
                    className={`text-sm transition-all duration-150 ${
                      isFirstInGroup
                        ? 'border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50'
                        : 'hover:bg-gray-50/50'
                    } ${isLastInGroup ? 'border-b-2 border-gray-200' : 'border-b border-gray-100'}`}
                  >
                    {/* 产品编码 */}
                    <TableCell
                      className={`${isFirstInGroup ? 'font-semibold text-blue-600' : 'pl-6 text-gray-400'}`}
                    >
                      {isFirstInGroup ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{group.productCode}</span>
                          {group.items.length > 1 && (
                            <span className="text-xs font-normal text-gray-500">
                              共 {group.items.length} 个批次
                            </span>
                          )}
                        </div>
                      ) : (
                        `└ ${group.productCode}`
                      )}
                    </TableCell>

                    {/* 产品名称 */}
                    <TableCell
                      className={`${isFirstInGroup ? 'font-medium text-gray-700' : 'text-gray-500'}`}
                    >
                      {group.productName}
                    </TableCell>

                    {/* 规格 */}
                    <TableCell
                      className={`${isFirstInGroup ? 'text-gray-700' : 'text-gray-500'}`}
                    >
                      {isFirstInGroup && group.items.length > 1 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{group.specification}</span>
                          <span className="text-xs font-semibold text-blue-600">
                            总计: {group.totalUnits}件+
                            {group.totalPieces % group.piecesPerUnit}片
                          </span>
                        </div>
                      ) : (
                        group.specification
                      )}
                    </TableCell>

                    {/* 批次号 */}
                    <TableCell className="font-mono font-medium text-blue-700">
                      {item.batchNumber || '-'}
                    </TableCell>

                    {/* 库存数量 */}
                    <TableCell className="font-semibold text-emerald-600">
                      {quantityDisplay}
                    </TableCell>

                    {/* 预留数量 */}
                    <TableCell className="font-medium text-orange-600">
                      {item.reservedQuantity || 0}
                    </TableCell>

                    {/* 可用数量 */}
                    <TableCell className="font-semibold text-gray-900">
                      {availableQuantityDisplay}
                    </TableCell>

                    {/* 库存状态 */}
                    <TableCell>
                      <Badge
                        variant={variant}
                        className={`text-xs font-medium ${color}`}
                      >
                        {label}
                      </Badge>
                    </TableCell>

                    {/* 最后更新 */}
                    <TableCell className="text-xs text-gray-500">
                      {formattedDate}
                    </TableCell>

                    {/* 操作 */}
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-md p-0 transition-colors hover:bg-blue-50"
                        onClick={() => onAdjust(item.id)}
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )
          )}
        </TableBody>
      </table>
    );
  }
);

InventoryGroupedTable.displayName = 'InventoryGroupedTable';

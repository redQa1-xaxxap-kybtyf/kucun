/**
 * 库存分组表格组件 - 支持合并单元格
 * 相同产品编码的记录会合并产品信息列，批次信息独立显示
 */

'use client';

import { Eye, Package } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
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
import type { Inventory } from '@/lib/types/inventory';
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

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
  remainingPieces: number; // 剩余片数（汇总时保留不同包装的零头）
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
        remainingPieces: 0,
      });
    } else {
      groups.get(code)!.items.push(inventory);
    }
  });

  // 计算每个分组的总计
  groups.forEach(group => {
    let totalPieces = 0;
    let totalUnits = 0;
    let remainingPieces = 0;

    group.items.forEach(item => {
      const packaging =
        item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 1;
      totalPieces += item.quantity;

      if (packaging > 0) {
        totalUnits += Math.floor(item.quantity / packaging);
        remainingPieces += item.quantity % packaging;
      } else {
        remainingPieces += item.quantity;
      }
    });

    group.totalPieces = totalPieces;
    group.totalUnits = totalUnits;
    group.remainingPieces = remainingPieces;
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

export const InventoryGroupedTable = React.memo<InventoryGroupedTableProps>(
  ({
    data,
    selectedIds: _selectedIds,
    isAllSelected: _isAllSelected,
    canSelectAll: _canSelectAll,
    onSelectAll: _onSelectAll,
    onSelectRow: _onSelectRow,
    onAdjust,
  }) => {
    const groups = React.useMemo(() => groupByProduct(data), [data]);

    return (
      <Table>
        <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
          <TableRow>
            <TableHead>产品编码</TableHead>
            <TableHead>产品名称</TableHead>
            <TableHead>规格</TableHead>
            <TableHead>包装信息</TableHead>
            <TableHead>重量(kg)</TableHead>
            <TableHead>批次号</TableHead>
            <TableHead>库存数量</TableHead>
            <TableHead>预留数量</TableHead>
            <TableHead>可用数量</TableHead>
            <TableHead>库存状态</TableHead>
            <TableHead>最后更新</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="p-8">
                <EmptyState
                  title="暂无库存数据"
                  icon={<Package className="text-muted-foreground h-6 w-6" />}
                  compact
                />
              </TableCell>
            </TableRow>
          ) : (
            groups.map(group =>
              group.items.map((item, index) => {
                const isFirstInGroup = index === 0;

                const packaging =
                  item.batchPiecesPerUnit ?? item.product?.piecesPerUnit ?? 0;
                const unitLabel = item.product?.unit
                  ? PRODUCT_UNIT_LABELS[
                      item.product.unit as keyof typeof PRODUCT_UNIT_LABELS
                    ] || item.product.unit
                  : '件';
                const quantityDisplay = formatPieceSummary(
                  item.quantity,
                  packaging,
                  {
                    prefix: '总计',
                    fallbackUnit: unitLabel,
                  }
                );
                const availableQuantity = Math.max(
                  item.quantity - (item.reservedQuantity ?? 0),
                  0
                );
                const { label, variant } = getInventoryStatus(
                  item.quantity,
                  item.reservedQuantity || 0
                );
                const formattedDate = new Date(
                  item.updatedAt
                ).toLocaleDateString('zh-CN');
                const reservedDisplay = (() => {
                  const reserved = item.reservedQuantity ?? 0;
                  if (reserved <= 0) {
                    return '0';
                  }
                  return formatPieceSummary(reserved, packaging, {
                    fallbackUnit: unitLabel,
                    zeroDisplay: '0',
                  });
                })();
                const availableDisplay = (() => {
                  if (availableQuantity <= 0) {
                    return '0';
                  }
                  return formatPieceSummary(availableQuantity, packaging, {
                    fallbackUnit: unitLabel,
                    zeroDisplay: '0',
                  });
                })();

                return (
                  <TableRow
                    key={item.id}
                    className={`border-b border-[hsl(var(--color-border-primary))] text-sm transition-colors hover:bg-[hsl(var(--color-primary-light))] ${isFirstInGroup ? 'border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]' : ''}`}
                  >
                    {/* 产品编码 */}
                    <TableCell
                      className={`${
                        isFirstInGroup
                          ? 'font-semibold text-[hsl(var(--color-primary))]'
                          : 'pl-6 text-[hsl(var(--color-text-tertiary))]'
                      }`}
                    >
                      {isFirstInGroup ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{group.productCode}</span>
                          {group.items.length > 1 && (
                            <span className="text-xs font-normal text-[hsl(var(--color-text-secondary))]">
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
                      className={`${
                        isFirstInGroup
                          ? 'font-medium text-[hsl(var(--color-text-primary))]'
                          : 'text-[hsl(var(--color-text-secondary))]'
                      }`}
                    >
                      {group.productName}
                    </TableCell>

                    {/* 规格 */}
                    <TableCell
                      className={`${
                        isFirstInGroup
                          ? 'text-[hsl(var(--color-text-secondary))]'
                          : 'text-[hsl(var(--color-text-tertiary))]'
                      }`}
                    >
                      {isFirstInGroup && group.items.length > 1 ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{group.specification}</span>
                          <span className="text-xs font-semibold text-[hsl(var(--color-primary))]">
                            总计: {group.totalUnits}件
                            {group.remainingPieces > 0
                              ? `+${group.remainingPieces}片`
                              : ''}
                          </span>
                        </div>
                      ) : (
                        group.specification
                      )}
                    </TableCell>

                    {/* 包装信息 */}
                    <TableCell
                      className={`${
                        isFirstInGroup
                          ? 'font-medium text-[hsl(var(--color-text-primary))]'
                          : 'text-[hsl(var(--color-text-secondary))]'
                      }`}
                    >
                      {packaging > 0 ? (
                        <span className="font-semibold">
                          {packaging}
                          <span className="ml-0.5 text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
                            片/件
                          </span>
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          -
                        </span>
                      )}
                    </TableCell>

                    {/* 重量 */}
                    <TableCell
                      className={`${
                        isFirstInGroup
                          ? 'font-medium text-[hsl(var(--color-text-primary))]'
                          : 'text-[hsl(var(--color-text-secondary))]'
                      }`}
                    >
                      {item.weight ? (
                        <span className="font-semibold">
                          {item.weight.toFixed(2)}
                          <span className="ml-0.5 text-xs font-normal text-[hsl(var(--color-text-tertiary))]">
                            kg
                          </span>
                        </span>
                      ) : (
                        <span className="text-[hsl(var(--color-text-tertiary))]">
                          -
                        </span>
                      )}
                    </TableCell>

                    {/* 批次号 */}
                    <TableCell className="font-mono font-medium text-[hsl(var(--color-primary))]">
                      {item.batchNumber || '-'}
                    </TableCell>

                    {/* 库存数量 */}
                    <TableCell className="font-semibold text-[hsl(var(--color-success))]">
                      {quantityDisplay}
                    </TableCell>

                    {/* 预留数量 */}
                    <TableCell className="font-medium text-[hsl(var(--color-warning))]">
                      {reservedDisplay}
                    </TableCell>

                    {/* 可用数量 */}
                    <TableCell className="font-semibold text-[hsl(var(--color-text-primary))]">
                      {availableDisplay}
                    </TableCell>

                    {/* 库存状态 */}
                    <TableCell>
                      <Badge variant={variant} className="text-xs font-medium">
                        {label}
                      </Badge>
                    </TableCell>

                    {/* 最后更新 */}
                    <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                      {formattedDate}
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="text-right">
                      {item.batchNumber ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group h-8 w-8 rounded-md p-0 transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                          onClick={() => onAdjust(item.id)}
                          title="查看库存变动详情"
                        >
                          <Eye className="h-4 w-4 text-[hsl(var(--color-text-secondary))] transition-colors group-hover:text-[hsl(var(--color-primary))]" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group h-8 w-8 cursor-not-allowed rounded-md p-0 text-[hsl(var(--color-text-tertiary))]"
                          disabled
                          title="暂无批次信息，无法查看详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )
          )}
        </TableBody>
      </Table>
    );
  }
);

InventoryGroupedTable.displayName = 'InventoryGroupedTable';

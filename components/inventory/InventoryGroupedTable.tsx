/**
 * 库存分组表格组件 - 支持合并单元格
 * 相同产品编码的记录会合并产品信息列，批次信息独立显示
 */

'use client';

import { Eye, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import * as React from 'react';

import { CopyableText } from '@/components/common/copyable-text';
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
import { can } from '@/lib/auth/permissions';
import type { Inventory } from '@/lib/types/inventory';
import { getInventoryStatus } from '@/lib/types/inventory-status';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatCostPrice } from '@/lib/utils/cost-price';
import { formatCurrency, formatCurrencyCompact } from '@/lib/utils/format';
import { groupInventoriesByProductCode } from '@/lib/utils/inventory-product-grouping';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryGroupedTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  /** ✅ 搜索关键词，用于区分无数据和搜索无结果 */
  searchQuery?: string;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  density: 'compact' | 'comfortable';
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
    onAdjust,
    searchQuery,
    hasActiveFilters,
    onClearFilters,
    density,
  }) => {
    const groups = React.useMemo(
      () => groupInventoriesByProductCode(data),
      [data]
    );
    const { data: session } = useSession();

    // 检查用户是否有财务查看权限
    const hasFinancePermission = React.useMemo(
      () => can(session?.user ?? null, 'finance:view'),
      [session?.user]
    );

    // ✅ 判断是否为搜索无结果
    const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
    const isFilteredEmpty = Boolean(hasSearchQuery || hasActiveFilters);
    const isEmptyState = data.length === 0;

    return (
      <Table
        className={`${hasFinancePermission ? 'min-w-[980px] 2xl:min-w-[1320px]' : 'min-w-[900px] 2xl:min-w-[1160px]'} [&_th]:whitespace-nowrap ${
          density === 'compact'
            ? '[&_td]:!px-2 [&_td]:!py-2 [&_th]:!px-2 [&_th]:!py-2'
            : ''
        }`}
      >
        <TableHeader className="sticky top-0 z-20 bg-white shadow-sm">
          <TableRow className="border-b border-slate-200 hover:bg-transparent">
            <TableHead className="hidden w-16 2xl:table-cell">预览图</TableHead>
            <TableHead>产品编码</TableHead>
            <TableHead>产品名称</TableHead>
            <TableHead>批次/规格</TableHead>
            <TableHead className="hidden 2xl:table-cell">包装信息</TableHead>
            <TableHead className="text-right">库存总量</TableHead>
            <TableHead className="text-right">预留/可用</TableHead>
            {hasFinancePermission && (
              <TableHead className="hidden text-right 2xl:table-cell">
                单位成本/货值评估
              </TableHead>
            )}
            <TableHead>健康度</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isEmptyState ? (
            <TableRow>
              <TableCell
                colSpan={hasFinancePermission ? 10 : 9}
                className="px-6 py-8"
              >
                <EmptyState
                  title={
                    isFilteredEmpty ? '未找到匹配的库存记录' : '暂无库存数据'
                  }
                  description={
                    isFilteredEmpty
                      ? '请尝试调整搜索条件或清空筛选后再试。'
                      : '还没有任何库存记录，您可以先进行产品入库。'
                  }
                  icon={<Package className="text-muted-foreground h-6 w-6" />}
                  action={
                    isFilteredEmpty ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (onClearFilters) {
                            onClearFilters();
                            return;
                          }
                          window.location.href = '/inventory';
                        }}
                      >
                        清空条件
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href="/inventory/inbound/create">去入库</Link>
                      </Button>
                    )
                  }
                  compact
                />
              </TableCell>
            </TableRow>
          ) : (
            groups.map(group =>
              group.items.map((item, index) => {
                const isFirstInGroup = index === 0;
                const isLastInGroup = index === group.items.length - 1;

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
                const reservedDisplay = (() => {
                  const reserved = item.reservedQuantity ?? 0;
                  if (reserved <= 0) return '0';
                  return formatPieceSummary(reserved, packaging, {
                    fallbackUnit: unitLabel,
                    zeroDisplay: '0',
                  });
                })();
                const availableDisplay = (() => {
                  if (availableQuantity <= 0) return '0';
                  return formatPieceSummary(availableQuantity, packaging, {
                    fallbackUnit: unitLabel,
                    zeroDisplay: '0',
                  });
                })();

                return (
                  <TableRow
                    key={item.id}
                    className={`group transition-all hover:bg-slate-50/80 ${
                      isLastInGroup ? 'border-b border-slate-200' : 'border-b-0'
                    }`}
                    onDoubleClick={() => onAdjust(item.id)}
                  >
                    {/* 产品预览区 */}
                    <TableCell className="hidden whitespace-nowrap 2xl:table-cell">
                      {isFirstInGroup ? (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-100 bg-white shadow-sm">
                          {group.thumbnailUrl ? (
                            <Image
                              src={group.thumbnailUrl}
                              alt={group.productName}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-slate-50">
                              <Package className="h-5 w-5 text-slate-300" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <div className="h-6 w-0.5 rounded-full bg-slate-100" />
                        </div>
                      )}
                    </TableCell>

                    {/* 产品编码 */}
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <div
                          className={`text-sm font-semibold tracking-tight ${isFirstInGroup ? 'text-slate-900' : 'text-slate-400'}`}
                        >
                          <CopyableText text={group.productCode} />
                        </div>
                      </div>
                    </TableCell>

                    {/* 产品名称 */}
                    <TableCell className="min-w-[180px]">
                      <div
                        className={`max-w-[160px] truncate text-xs font-bold transition-colors 2xl:max-w-[200px] ${isFirstInGroup ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-400'}`}
                      >
                        {group.productName}
                      </div>
                    </TableCell>

                    {/* 批次规格 */}
                    <TableCell className="min-w-[150px]">
                      <div className="flex flex-col gap-1">
                        <div className="max-w-[130px] truncate text-xs font-medium text-slate-500 2xl:max-w-[150px]">
                          {formatSpecification(group.specification)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="h-4 border-amber-100 bg-amber-50 px-1.5 text-[9px] font-semibold text-amber-600"
                          >
                            {item.batchNumber
                              ? item.batchNumber.toUpperCase().slice(-8)
                              : '常规'}
                          </Badge>
                          {isFirstInGroup && group.items.length > 1 && (
                            <Badge className="h-4 bg-indigo-600 px-1.5 text-[9px] font-semibold text-white shadow-sm shadow-indigo-200">
                              共 {group.items.length} 批次
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* 包装信息 */}
                    <TableCell className="hidden whitespace-nowrap 2xl:table-cell">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-slate-700">
                            {packaging}
                          </span>
                          <span className="rounded-md border border-blue-50 bg-blue-50/30 px-1 py-0.5 text-[9px] font-semibold text-blue-500">
                            片/件
                          </span>
                        </div>
                        {item.weight ? (
                          <div className="text-[11px] font-bold text-slate-400 tabular-nums">
                            {item.weight.toFixed(2)} kg
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* 库存总量 */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1.5">
                        {isFirstInGroup && group.items.length > 1 && (
                          <div className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white shadow-md ring-2 ring-white">
                            多批次合计 {group.totalQuantityDisplay}
                          </div>
                        )}
                        <div
                          className={`text-sm font-semibold ${isFirstInGroup ? 'text-emerald-600' : 'text-slate-400'}`}
                        >
                          {quantityDisplay}
                        </div>
                      </div>
                    </TableCell>

                    {/* 预留/可用 */}
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <span>预留 {reservedDisplay}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {isFirstInGroup && group.items.length > 1 && (
                            <div className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                              多批次可用 {group.totalAvailableDisplay}
                            </div>
                          )}
                          <div
                            className={`text-sm font-semibold ${isFirstInGroup ? 'text-indigo-600' : 'text-slate-400'}`}
                          >
                            {availableDisplay}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* 货值评估 */}
                    {hasFinancePermission && (
                      <TableCell className="hidden text-right whitespace-nowrap 2xl:table-cell">
                        {item.unitCost !== null &&
                        item.unitCost !== undefined ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[10px] font-bold text-slate-400">
                              成本单价: {formatCostPrice(item.unitCost)}
                            </div>
                            <div
                              className="text-sm font-semibold text-slate-900"
                              title={formatCurrency(item.quantity * item.unitCost)}
                            >
                              {formatCurrencyCompact(item.quantity * item.unitCost)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                    )}

                    {/* 健康状态 */}
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={variant}
                        className={`rounded-full px-3 py-0.5 text-[10px] font-semibold ${
                          variant === 'destructive' || variant === 'warning'
                            ? 'animate-breathe'
                            : ''
                        }`}
                      >
                        {label}
                      </Badge>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-md text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                        onClick={e => {
                          e.stopPropagation();
                          onAdjust(item.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
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

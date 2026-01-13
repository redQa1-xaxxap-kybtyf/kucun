/**
 * 库存分组表格组件 - 支持合并单元格
 * 相同产品编码的记录会合并产品信息列，批次信息独立显示
 */

'use client';

import { Eye, Package } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
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
import { formatCurrency } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface InventoryGroupedTableProps {
  data: Inventory[];
  onAdjust: (id: string) => void;
  /** ✅ 搜索关键词，用于区分无数据和搜索无结果 */
  searchQuery?: string;
  density: 'compact' | 'comfortable';
}

interface ProductGroup {
  productCode: string;
  productName: string;
  specification: string;
  thumbnailUrl?: string; // 产品缩略图URL
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

    const existingGroup = groups.get(code);

    if (!existingGroup) {
      groups.set(code, {
        productCode: code,
        productName: inventory.product?.name || '-',
        specification: formatSpecification(inventory.product?.specification),
        thumbnailUrl: inventory.product?.thumbnailUrl,
        items: [inventory],
        totalPieces: 0,
        totalUnits: 0,
        remainingPieces: 0,
      });
    } else {
      existingGroup.items.push(inventory);
    }
  });

  // 计算每个分组的总计
  groups.forEach(group => {
    const totalPieces = group.items.reduce((sum, item) => sum + item.quantity, 0);
    const firstItem = group.items[0];
    const packaging = firstItem.batchPiecesPerUnit ?? firstItem.product?.piecesPerUnit ?? 0;

    group.totalPieces = totalPieces;
    if (packaging > 0) {
      group.totalUnits = Math.floor(totalPieces / packaging);
      group.remainingPieces = totalPieces % packaging;
    } else {
      group.totalUnits = 0;
      group.remainingPieces = totalPieces;
    }
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
  ({ data, onAdjust, searchQuery, density }) => {
    const groups = React.useMemo(() => groupByProduct(data), [data]);
    const { data: session } = useSession();

    // 检查用户是否有财务查看权限
    const hasFinancePermission = React.useMemo(
      () => can(session?.user ?? null, 'finance:view'),
      [session?.user]
    );

    // ✅ 判断是否为搜索无结果
    const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
    const isEmptyState = data.length === 0;

    return (
      <Table
        className={
          density === 'compact'
            ? '[&_td]:!px-2 [&_td]:!py-2 [&_th]:!px-2 [&_th]:!py-2'
            : ''
        }
      >
        <TableHeader className="card-shadow-light sticky top-0 z-20 bg-white/95 backdrop-blur-md">
          <TableRow className="border-b border-slate-200 hover:bg-transparent">
            <TableHead className="w-16 py-4 font-black text-slate-700">预览图</TableHead>
            <TableHead className="py-4 font-black text-slate-700">产品编码 / SKU</TableHead>
            <TableHead className="py-4 font-black text-slate-700">产品名称</TableHead>
            <TableHead className="py-4 font-black text-slate-700">批次/规格</TableHead>
            <TableHead className="py-4 font-black text-slate-700">装箱数</TableHead>
            <TableHead className="py-4 text-right font-black text-slate-700">库存总量</TableHead>
            <TableHead className="py-4 text-right font-black text-slate-700">预留/可用</TableHead>
            {hasFinancePermission && (
              <TableHead className="py-4 text-right font-black text-slate-700">
                单位成本/货值评估
              </TableHead>
            )}
            <TableHead className="py-4 font-black text-slate-700">健康度</TableHead>
            <TableHead className="py-4 font-black text-slate-700 text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isEmptyState ? (
            <TableRow>
              <TableCell
                colSpan={hasFinancePermission ? 13 : 12}
                className="p-8"
              >
                <EmptyState
                  title={
                    hasSearchQuery ? '未找到匹配的库存记录' : '暂无库存数据'
                  }
                  description={
                    hasSearchQuery
                      ? '请尝试调整搜索条件或清空筛选后再试。'
                      : '还没有任何库存记录，您可以先进行产品入库。'
                  }
                  icon={<Package className="text-muted-foreground h-6 w-6" />}
                  action={
                    hasSearchQuery ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 简单方案：跳转到库存总览根路径，清空所有筛选
                          window.location.href = '/inventory';
                        }}
                      >
                        清空筛选
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
            groups.map((group, groupIndex) => {
              return group.items.map((item, index) => {
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
                      isLastInGroup
                        ? 'border-b border-slate-200'
                        : 'border-b-0'
                    }`}
                    onDoubleClick={() => onAdjust(item.id)}
                  >
                    {/* 产品预览区 */}
                    <TableCell className="py-3">
                      {isFirstInGroup ? (
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm transition-transform group-hover:scale-105">
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
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1">
                        <div className={`text-sm font-black tracking-tight ${isFirstInGroup ? 'text-slate-900' : 'text-slate-400'}`}>
                          <CopyableText text={group.productCode} />
                        </div>
                      </div>
                    </TableCell>

                    {/* 产品名称 */}
                    <TableCell className="py-3">
                      <div className={`max-w-[200px] truncate text-xs font-bold transition-colors ${isFirstInGroup ? 'text-slate-600 group-hover:text-slate-900' : 'text-slate-400'}`}>
                        {group.productName}
                      </div>
                    </TableCell>

                    {/* 批次规格 */}
                    <TableCell className="py-3">
                       <div className="flex flex-col gap-1">
                         <div className="max-w-[150px] truncate text-xs font-medium text-slate-500">
                           {group.specification}
                         </div>
                         <div className="flex items-center gap-1.5">
                           <Badge
                             variant="outline"
                             className="h-4 border-amber-100 bg-amber-50 px-1.5 text-[9px] font-black text-amber-600"
                           >
                             {item.batchNumber
                               ? item.batchNumber.toUpperCase().slice(-8)
                               : '常规'}
                           </Badge>
                           {isFirstInGroup && group.items.length > 1 && (
                             <Badge className="h-4 bg-indigo-600 px-1.5 text-[9px] font-black text-white shadow-sm shadow-indigo-200">
                               共 {group.items.length} 批次
                             </Badge>
                           )}
                         </div>
                       </div>
                    </TableCell>

                    {/* 包装信息 */}
                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                           <span className="text-sm font-black text-slate-700">{packaging}</span>
                           <span className="rounded-md border border-blue-50 bg-blue-50/30 px-1 py-0.5 text-[9px] font-black text-blue-500 uppercase">
                             片/件
                           </span>
                        </div>
                        {item.weight ? (
                          <div className="text-[11px] font-bold text-slate-400 tabular-nums">
                            {item.weight.toFixed(2)} KG
                          </div>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* 库存总量 */}
                    <TableCell className="py-3 text-right">
                       <div className="flex flex-col items-end gap-1.5">
                         {isFirstInGroup && group.items.length > 1 && (
                            <div className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white shadow-md ring-2 ring-white">
                               汇总: {group.totalUnits}件{group.remainingPieces > 0 ? `+${group.remainingPieces}片` : ''}
                            </div>
                         )}
                         <div className={`text-sm font-black ${isFirstInGroup ? 'text-emerald-600' : 'text-slate-400'}`}>
                           {quantityDisplay}
                         </div>
                       </div>
                    </TableCell>

                    {/* 预留/可用 */}
                    <TableCell className="py-3 text-right">
                       <div className="flex flex-col items-end gap-1">
                         <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                            <span>预留 {reservedDisplay}</span>
                         </div>
                         <div className="flex flex-col items-end gap-1.5">
                            {isFirstInGroup && group.items.length > 1 && (
                               <div className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-600 border border-slate-200">
                                  总可用: {availableDisplay.replace('总计', '').trim()}
                               </div>
                            )}
                            <div className={`text-sm font-black ${isFirstInGroup ? 'text-indigo-600' : 'text-slate-400'}`}>
                               {availableDisplay}
                            </div>
                         </div>
                       </div>
                    </TableCell>

                    {/* 货值评估 */}
                    {hasFinancePermission && (
                      <TableCell className="py-3 text-right">
                        {item.unitCost ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[10px] font-bold text-slate-400">
                              成本单价: {formatCurrency(item.unitCost)}
                            </div>
                            <div className="text-sm font-black text-slate-900">
                              {formatCurrency(item.quantity * item.unitCost)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </TableCell>
                    )}

                    {/* 健康状态 */}
                    <TableCell className="py-3">
                      <Badge
                        variant={variant}
                        className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          variant === 'destructive' || variant === 'warning'
                            ? 'animate-breathe'
                            : ''
                        }`}
                      >
                        {label}
                      </Badge>
                    </TableCell>

                    {/* 操作 */}
                    <TableCell className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 rounded-xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
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
              });
            })
          )}
        </TableBody>
      </Table>
    );
  }
);

InventoryGroupedTable.displayName = 'InventoryGroupedTable';

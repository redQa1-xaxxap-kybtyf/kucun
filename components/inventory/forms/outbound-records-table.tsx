'use client';

import { Package, User } from 'lucide-react';

import { CopyableText } from '@/components/common/copyable-text';
import { EmptyState } from '@/components/common/empty-state';
import { ContentLoading } from '@/components/common/loading';
import { RelativeTime } from '@/components/common/relative-time';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  OUTBOUND_REASON_LABELS,
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  type OutboundRecord,
} from '@/lib/types/inventory';

interface OutboundRecordsTableProps {
  records: OutboundRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onPageChange?: (page: number) => void;
}

// 格式化产品规格显示（限制11个字符，避免JSON字符串显示）
const formatSpecification = (specification?: string) => {
  if (!specification) {
    return null;
  }

  // 如果是JSON字符串，尝试解析并提取关键信息
  if (specification.startsWith('{') && specification.endsWith('}')) {
    try {
      const parsed = JSON.parse(specification);
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
      return specification.length > 11
        ? `${specification.slice(0, 11)}...`
        : specification;
    }
  }

  // 普通字符串，直接截断
  return specification.length > 11
    ? `${specification.slice(0, 11)}...`
    : specification;
};

// 获取记录的重量显示
const getActualWeight = (record: OutboundRecord) => {
  const weight = record.totalWeight ?? record.weightPerUnit ?? null;
  return weight ? `${Number(weight).toFixed(2)} kg` : '-';
};

// 格式化数量显示
const formatQuantity = (quantity: number, piecesPerUnit?: number) => {
  if (!piecesPerUnit || piecesPerUnit <= 1) {
    return `${quantity}片`;
  }
  const units = Math.floor(quantity / piecesPerUnit);
  const pieces = quantity % piecesPerUnit;

  if (units === 0) return `${pieces}片`;
  if (pieces === 0) return `${units}件`;
  return `${units}件 + ${pieces}片`;
};

export function OutboundRecordsTable({
  records,
  pagination,
  isLoading,
  onPageChange,
}: OutboundRecordsTableProps) {
  if (isLoading) {
    return <ContentLoading text="加载出库记录..." />;
  }

  return (
    <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">
            出库记录流水 ({records.length} 条)
          </span>
        </div>
      </div>

      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto xl:block">
        <Table className="min-w-[1120px] [&_th]:whitespace-nowrap">
          <TableHeader className="card-shadow-light">
            <TableRow className="border-b border-slate-200 hover:bg-transparent">
              <TableHead className="py-4 font-semibold text-slate-700">
                单据编号
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                产品编码
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                产品名称
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                批次/规格
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                装箱数
              </TableHead>
              <TableHead className="py-4 text-right font-semibold text-slate-700">
                出库总量
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                业务类型
              </TableHead>
              <TableHead className="py-4 font-semibold text-slate-700">
                经办时间
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-8">
                  <EmptyState
                    title="暂无出库记录流水"
                    description="目前没有任何出库数据，您可以点击上方按钮办理出库。"
                    icon={<Package className="text-muted-foreground h-6 w-6" />}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map(record => (
                <TableRow
                  key={record.id}
                  className="group border-b border-slate-100 transition-colors hover:bg-blue-50/30"
                >
                  <TableCell className="py-4 whitespace-nowrap">
                    <div className="text-[11px] font-bold text-slate-400">
                      <CopyableText text={record.id.slice(-8).toUpperCase()} />
                    </div>
                  </TableCell>
                  <TableCell className="py-4 whitespace-nowrap">
                    <div className="text-sm leading-tight font-semibold text-slate-900">
                      <CopyableText text={record.productCode || '-'} />
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[180px] py-4">
                    <div className="max-w-[180px] truncate text-xs font-bold text-slate-600">
                      {record.productName}
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[180px] py-4">
                    <div className="flex flex-col gap-1.5">
                      {record.batchNumber ? (
                        <Badge
                          variant="outline"
                          className="w-fit border-amber-100 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-600"
                        >
                          {record.batchNumber}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-slate-300">
                          无批次
                        </span>
                      )}
                      <div className="text-[10px] font-medium text-slate-400">
                        {formatSpecification(record.productSpecification) ||
                          '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">
                        {record.piecesPerUnit || '-'}
                      </span>
                      <span className="rounded-md border border-blue-50 bg-blue-50/30 px-1 py-0.5 text-[9px] font-semibold text-blue-500">
                        片/件
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="text-sm font-semibold text-slate-900">
                        {formatQuantity(record.quantity, record.piecesPerUnit)}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        {getActualWeight(record)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[150px] py-4">
                    <div className="flex flex-col gap-1">
                      <Badge
                        variant={
                          OUTBOUND_TYPE_VARIANTS[record.type] || 'default'
                        }
                        className="w-fit text-[10px] font-semibold"
                      >
                        {OUTBOUND_TYPE_LABELS[record.type] || '未知'}
                      </Badge>
                      <div className="text-[10px] font-bold text-slate-400">
                        {record.reason
                          ? (OUTBOUND_REASON_LABELS[record.reason] ??
                            record.reason)
                          : '-'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <User className="h-3 w-3 text-slate-300" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-slate-600">
                          <RelativeTime date={record.createdAt} />
                        </span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 p-3 xl:hidden">
        {records.length === 0 ? (
          <EmptyState
            title="暂无出库记录"
            icon={<Package className="text-muted-foreground h-6 w-6" />}
            compact
          />
        ) : (
          records.map(record => (
            <div
              key={record.id}
              className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm leading-tight font-semibold text-slate-900">
                    {record.productCode || '-'}
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-slate-400">
                    {record.productName || '未知产品'}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <div className="text-[11px] text-slate-500">
                      规格：
                      <span className="font-bold text-slate-600">
                        {formatSpecification(record.productSpecification) ||
                          '-'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
                      <span className="flex items-center gap-1">
                        批次：
                        {record.batchNumber ? (
                          <Badge
                            variant="outline"
                            className="h-4 border-amber-100 bg-amber-50 px-1 text-[9px] font-semibold text-amber-600"
                          >
                            {record.batchNumber}
                          </Badge>
                        ) : (
                          <span className="text-slate-300">无</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500">
                        包装：
                        <span className="font-semibold text-slate-600">
                          {record.piecesPerUnit || '-'}
                        </span>
                        <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-500">
                          片/件
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Badge
                    variant={OUTBOUND_TYPE_VARIANTS[record.type] || 'default'}
                    className="mb-1 text-[10px] font-semibold"
                  >
                    {OUTBOUND_TYPE_LABELS[record.type] || '未知'}
                  </Badge>
                  <div className="text-[11px] font-bold text-slate-400">
                    {record.id.slice(-6).toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <User className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold text-slate-500">
                    <RelativeTime date={record.createdAt} />
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <div className="text-sm font-semibold text-slate-900">
                    {formatQuantity(record.quantity, record.piecesPerUnit)}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400">
                    {getActualWeight(record)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页器 */}
      {pagination && onPageChange && (
        <div className="border-t border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-tertiary))] px-4 py-3">
          <Pagination
            pagination={pagination}
            onPageChange={onPageChange}
            showRange
            showTotal
            disabled={isLoading}
          />
        </div>
      )}
    </div>
  );
}

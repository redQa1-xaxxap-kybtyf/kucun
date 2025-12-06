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

// 格式化数量显示（X件Y片（共XX片））
const formatQuantity = (quantity: number, piecesPerUnit?: number) => {
  // 数据验证
  if (!quantity || !piecesPerUnit || piecesPerUnit <= 0) {
    return `${quantity || 0}片`;
  }

  const units = Math.floor(quantity / piecesPerUnit);
  const pieces = quantity % piecesPerUnit;

  if (units === 0) {
    return `${pieces}片`;
  }

  if (pieces === 0) {
    return `${units}件（共${quantity}片）`;
  }

  return `${units}件${pieces}片（共${quantity}片）`;
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
      <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-[hsl(var(--color-primary))]" />
          <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
            出库记录 ({records.length} 条)
          </span>
        </div>
      </div>

      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader className="card-shadow-light">
            <TableRow>
              <TableHead>产品编码</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>批次号</TableHead>
              <TableHead>每件片数</TableHead>
              <TableHead>出库数量</TableHead>
              <TableHead>出库类型</TableHead>
              <TableHead>出库原因</TableHead>
              <TableHead>操作时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-8">
                  <EmptyState
                    title="暂无出库记录"
                    icon={<Package className="text-muted-foreground h-6 w-6" />}
                    compact
                  />
                </TableCell>
              </TableRow>
            ) : (
              records.map(record => (
                <TableRow
                  key={record.id}
                  className="h-10 border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                >
                  <TableCell className="text-xs font-medium text-[hsl(var(--color-text-primary))]">
                    {record.productCode ? (
                      <CopyableText text={record.productCode} />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
                    {record.productName}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {formatSpecification(record.productSpecification) || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.batchNumber ? (
                      <CopyableText text={record.batchNumber} />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.piecesPerUnit || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
                    <span className="font-medium">
                      {formatQuantity(record.quantity, record.piecesPerUnit)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-primary))]">
                    <Badge
                      variant={OUTBOUND_TYPE_VARIANTS[record.type] || 'default'}
                      className="text-xs font-medium"
                    >
                      {OUTBOUND_TYPE_LABELS[record.type] || '未知'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.reason
                      ? (OUTBOUND_REASON_LABELS[record.reason] ?? record.reason)
                      : (OUTBOUND_REASON_LABELS[record.type] ??
                        OUTBOUND_TYPE_LABELS[record.type] ??
                        '-')}
                  </TableCell>
                  <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                    <div className="flex items-center gap-1 text-[hsl(var(--color-text-secondary))]">
                      <User className="h-3 w-3" />
                      <RelativeTime date={record.createdAt} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 p-3 md:hidden">
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
              className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                    {record.productCode || '-'}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                    {record.productName || '未知产品'}
                  </div>
                  <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    规格：
                    {formatSpecification(record.productSpecification) || '-'}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                    <span>批次：{record.batchNumber || '-'}</span>
                    <span>每件：{record.piecesPerUnit || '-'}片</span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                  <Badge
                    variant={OUTBOUND_TYPE_VARIANTS[record.type] || 'default'}
                    className="mb-1 text-xs font-medium"
                  >
                    {OUTBOUND_TYPE_LABELS[record.type] || '未知'}
                  </Badge>
                  <div className="text-[hsl(var(--color-text-secondary))]">
                    {record.reason
                      ? (OUTBOUND_REASON_LABELS[record.reason] ?? record.reason)
                      : (OUTBOUND_REASON_LABELS[record.type] ??
                        OUTBOUND_TYPE_LABELS[record.type] ??
                        '-')}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-1">
                    <User className="h-3 w-3" />
                    <RelativeTime date={record.createdAt} />
                  </div>
                </div>
              </div>

              <div className="mt-2 text-xs text-[hsl(var(--color-text-secondary))]">
                出库数量：
                <span className="font-medium text-[hsl(var(--color-text-primary))]">
                  {formatQuantity(record.quantity, record.piecesPerUnit)}
                </span>
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

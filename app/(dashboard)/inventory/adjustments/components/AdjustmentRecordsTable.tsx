/**
 * 库存调整记录表格组件
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */

'use client';

import { Eye, Package, User } from 'lucide-react';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  getAdjustmentReasonLabel,
  type InventoryAdjustment,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';
import { formatDetailedPieceSummary } from '@/lib/utils/piece-calculation';

interface AdjustmentRecordsTableProps {
  adjustments: InventoryAdjustment[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  onViewDetail?: (adjustment: InventoryAdjustment) => void;
  onPageChange?: (page: number) => void;
}

export function AdjustmentRecordsTable({
  adjustments,
  pagination,
  isLoading,
  onViewDetail,
  onPageChange,
}: AdjustmentRecordsTableProps) {
  // 格式化日期
  const formatDate = (dateString: string | Date) => {
    if (!dateString) {
      return null;
    }
    return formatDateTimeCN(dateString);
  };

  // 格式化调整数量显示
  const formatAdjustQuantity = (quantity: number, piecesPerUnit: number) => {
    const quantityText = formatDetailedPieceSummary(
      Math.abs(quantity),
      piecesPerUnit,
      { zeroDisplay: '0片' }
    );

    if (quantity > 0) {
      return (
        <span className="font-medium text-[hsl(var(--color-success))]">
          +{quantityText}
        </span>
      );
    }

    if (quantity < 0) {
      return (
        <span className="font-medium text-[hsl(var(--color-error))]">
          -{quantityText}
        </span>
      );
    }

    return (
      <span className="font-medium text-[hsl(var(--color-text-primary))]">
        {quantityText}
      </span>
    );
  };

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

  const getPiecesPerUnit = (adjustment: InventoryAdjustment) =>
    adjustment.batchPiecesPerUnit ?? adjustment.product?.piecesPerUnit ?? 0;

  if (isLoading) {
    return <ContentLoading text="加载调整记录..." />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
      {/* 桌面端表格视图 */}
      <div className="hidden overflow-x-auto xl:block">
        <Table className="min-w-[1080px] [&_th]:whitespace-nowrap">
          <TableHeader className="shadow-sm">
            <TableRow>
              <TableHead>产品编码</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>规格</TableHead>
              <TableHead>批次号</TableHead>
              <TableHead>包装信息</TableHead>
              <TableHead className="text-right">调整数量</TableHead>
              <TableHead>调整原因</TableHead>
              <TableHead>操作时间/人员</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <div className="text-muted-foreground flex flex-col items-center gap-2">
                    <Package className="h-8 w-8" />
                    <span className="text-sm">暂无调整记录</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              adjustments.map(adjustment => (
                <TableRow
                  key={adjustment.id}
                  className="h-10 border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                >
                  <TableCell className="text-xs font-medium whitespace-nowrap text-[hsl(var(--color-text-primary))]">
                    {adjustment.product?.code || '-'}
                  </TableCell>
                  <TableCell className="min-w-[180px] text-xs text-[hsl(var(--color-text-primary))]">
                    {adjustment.product?.name || '未知产品'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                    {formatSpecification(adjustment.product?.specification) ||
                      '-'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                    {adjustment.batchNumber || '-'}
                  </TableCell>
                  <TableCell className="text-center text-xs whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                    {getPiecesPerUnit(adjustment) > 0
                      ? `${getPiecesPerUnit(adjustment)}片/件`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap text-[hsl(var(--color-text-primary))]">
                    <div className="flex flex-col items-end gap-0.5">
                      {formatAdjustQuantity(
                        adjustment.adjustQuantity,
                        getPiecesPerUnit(adjustment)
                      )}
                      <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                        {formatDetailedPieceSummary(
                          adjustment.beforeQuantity,
                          getPiecesPerUnit(adjustment)
                        )}{' '}
                        →{' '}
                        {formatDetailedPieceSummary(
                          adjustment.afterQuantity,
                          getPiecesPerUnit(adjustment)
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-[hsl(var(--color-text-primary))]">
                    <Badge variant="info" className="text-xs font-medium">
                      {getAdjustmentReasonLabel(adjustment.reason)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap text-[hsl(var(--color-text-secondary))]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[hsl(var(--color-text-secondary))]">
                        <User className="h-3 w-3" />
                        {formatDate(adjustment.createdAt)}
                      </div>
                      <div className="text-[11px] text-[hsl(var(--color-text-tertiary))]">
                        {adjustment.operator?.name || '—'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {onViewDetail && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetail(adjustment)}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片视图 */}
      <div className="space-y-3 p-3 xl:hidden">
        {adjustments.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-6 text-sm">
            <Package className="h-8 w-8" />
            <span>暂无调整记录</span>
          </div>
        ) : (
          adjustments.map(adjustment => {
            const ppu = getPiecesPerUnit(adjustment);
            const beforeText = formatDetailedPieceSummary(
              adjustment.beforeQuantity,
              ppu
            );
            const afterText = formatDetailedPieceSummary(
              adjustment.afterQuantity,
              ppu
            );

            return (
              <div
                key={adjustment.id}
                className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      {adjustment.product?.code || '-'}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      {adjustment.product?.name || '未知产品'}
                    </div>
                    <div className="mt-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      规格：
                      {formatSpecification(adjustment.product?.specification) ||
                        '-'}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      <span>批次：{adjustment.batchNumber || '-'}</span>
                      <span>
                        包装：
                        {ppu > 0 ? `${ppu}片/件` : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                    <Badge variant="info" className="mb-1 text-xs font-medium">
                      {getAdjustmentReasonLabel(adjustment.reason)}
                    </Badge>
                    <div className="flex items-center justify-end gap-1">
                      <User className="h-3 w-3" />
                      {formatDate(adjustment.createdAt)}
                    </div>
                    <div className="mt-1 text-[11px]">
                      {adjustment.operator?.name || '—'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs text-[hsl(var(--color-text-secondary))]">
                  调整数量：
                  {formatAdjustQuantity(
                    adjustment.adjustQuantity,
                    getPiecesPerUnit(adjustment)
                  )}
                  <span className="ml-1 text-[hsl(var(--color-text-secondary))]">
                    {beforeText} → {afterText}
                  </span>
                </div>

                {onViewDetail && (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(adjustment)}
                      className="h-7 px-2 text-xs"
                    >
                      <Eye className="mr-1 h-3 w-3" />
                      查看详情
                    </Button>
                  </div>
                )}
              </div>
            );
          })
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

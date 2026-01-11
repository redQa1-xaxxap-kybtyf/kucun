'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, History, PackageSearch, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import type {
    BatchSpecification,
    BatchSpecificationListResponse,
} from '@/lib/types/batch-specification';
import { formatNumber } from '@/lib/utils/format';

interface BatchSpecificationsTableProps {
  data: BatchSpecification[];
  pagination: BatchSpecificationListResponse['pagination'];
  isLoading: boolean;
  isFetching: boolean;
  onPageChange: (page: number) => void;
  onEdit: (spec: BatchSpecification) => void;
  onDelete: (spec: BatchSpecification) => void;
}

export function BatchSpecificationsTable({
  data,
  pagination,
  isLoading,
  isFetching,
  onPageChange,
  onEdit,
  onDelete,
}: BatchSpecificationsTableProps) {
  const showSkeleton = isLoading && !data.length;
  const showEmptyState = !isLoading && data.length === 0;

  const formatMeasurement = (
    value: number | null | undefined,
    unit: string,
    precision: number = 2
  ) => {
    if (value === undefined || value === null) {
      return '-';
    }

    return `${formatNumber(value, precision)}${unit}`;
  };

  const formatDate = (dateString: string) =>
    format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
      <div className="p-0">
        {/* 桌面端：宽表格视图，支持横向滚动 */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="card-shadow-light">
                <TableRow>
                  <TableHead>批次号</TableHead>
                  <TableHead>产品编码</TableHead>
                  <TableHead>产品名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>每件片数</TableHead>
                  <TableHead>重量</TableHead>
                  <TableHead>厚度</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showSkeleton
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={`batch-skeleton-${index}`}>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-8 w-32" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data.map(spec => (
                      <TableRow
                        key={spec.id}
                        className="h-12 border-b border-[hsl(var(--color-border-primary))] transition-colors hover:bg-[hsl(var(--color-primary-light))]"
                      >
                        <TableCell className="text-xs font-medium text-[hsl(var(--color-primary))]">
                          {spec.batchNumber}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-[hsl(var(--color-primary))]">
                          {spec.product?.code || '-'}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-[hsl(var(--color-text-primary))]">
                          {spec.product?.name || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {spec.product?.specification || '-'}
                        </TableCell>
                        <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {formatNumber(spec.piecesPerUnit)}
                        </TableCell>
                        <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {formatMeasurement(spec.weight, 'kg', 2)}
                        </TableCell>
                        <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                          {formatMeasurement(spec.thickness, 'mm', 2)}
                        </TableCell>
                        <TableCell className="text-xs text-[hsl(var(--color-text-secondary))]">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(spec.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link
                                href={`/inventory/batch/${encodeURIComponent(
                                  spec.batchNumber
                                )}/history?productId=${spec.productId}`}
                                prefetch={false}
                              >
                                <History className="mr-1 h-3 w-3" />
                                流水
                              </Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEdit(spec)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              编辑
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => onDelete(spec)}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              删除
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                {showEmptyState ? (
                  <TableRow>
                    <TableCell colSpan={9} className="p-8">
                      <EmptyState
                        title="暂无批次规格"
                        description="请调整筛选条件或点击右上角按钮新建批次规格"
                        icon={
                          <PackageSearch className="text-muted-foreground h-6 w-6" />
                        }
                        compact
                      />
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* 移动端：卡片视图，避免宽表格在小屏上难以浏览 */}
        <div className="space-y-3 px-4 py-3 md:hidden">
          {showSkeleton ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`batch-card-skeleton-${index}`}
                className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-8 w-28" />
                  </div>
                </div>
              </div>
            ))
          ) : showEmptyState ? (
            <EmptyState
              title="暂无批次规格"
              description="请调整筛选条件或点击右上角按钮新建批次规格"
              icon={<PackageSearch className="text-muted-foreground h-6 w-6" />}
              compact
            />
          ) : (
            data.map(spec => (
              <div
                key={spec.id}
                className="card-shadow-light rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-[hsl(var(--color-text-secondary))]">
                      批次：{' '}
                      <span className="font-medium text-[hsl(var(--color-primary))]">
                        {spec.batchNumber}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[hsl(var(--color-text-secondary))]">
                      编码：{spec.product?.code || '-'}
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-[hsl(var(--color-text-primary))]">
                      {spec.product?.name || '-'}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-[hsl(var(--color-text-secondary))]">
                      规格：{spec.product?.specification || '-'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[hsl(var(--color-text-secondary))]">
                      <span>
                        每件：
                        <span className="font-medium text-[hsl(var(--color-text-primary))]">
                          {formatNumber(spec.piecesPerUnit)}
                        </span>
                        片
                      </span>
                      <span>
                        重量：
                        <span className="font-medium text-[hsl(var(--color-text-primary))]">
                          {formatMeasurement(spec.weight, 'kg', 2)}
                        </span>
                      </span>
                      <span>
                        厚度：
                        <span className="font-medium text-[hsl(var(--color-text-primary))]">
                          {formatMeasurement(spec.thickness, 'mm', 2)}
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-[hsl(var(--color-text-secondary))]">
                    <div className="flex items-center justify-end gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(spec.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    asChild
                  >
                    <Link
                      href={`/inventory/batch/${encodeURIComponent(
                        spec.batchNumber
                      )}/history?productId=${spec.productId}`}
                      prefetch={false}
                    >
                      <History className="mr-1 h-3 w-3" />
                      流水
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => onEdit(spec)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => onDelete(spec)}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    删除
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination
          pagination={pagination}
          onPageChange={onPageChange}
          disabled={isLoading}
          containerClassName="px-4 py-3"
        />
      </div>
    </div>
  );
}

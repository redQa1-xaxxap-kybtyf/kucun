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
    <div
      className="overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]"
      style={{ boxShadow: 'var(--shadow-medium)' }}
    >
      <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackageSearch className="h-4 w-4 text-[hsl(var(--color-primary))]" />
            <span className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
              批次规格列表 ({pagination.total} 条)
            </span>
          </div>
          {isFetching && !isLoading ? (
            <span className="text-xs text-[hsl(var(--color-text-tertiary))]">
              更新中...
            </span>
          ) : null}
        </div>
      </div>

      <div className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader style={{ boxShadow: 'var(--shadow-light)' }}>
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

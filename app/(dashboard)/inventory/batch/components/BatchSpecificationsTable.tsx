'use client';

import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar, History, PackageSearch, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
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
  isFetching: _isFetching,
  onPageChange,
  onEdit,
  onDelete,
}: BatchSpecificationsTableProps) {
  const showSkeleton = isLoading && !data.length;
  const showEmptyState = !isLoading && data.length === 0;

  const formatDate = (dateString: string) =>
    format(new Date(dateString), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });

  return (
    <div className="overflow-hidden rounded-xl border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] shadow-sm">
      <div className="p-0">
        {/* 桌面端：宽表格视图，支持横向滚动 */}
        <div className="hidden xl:block">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="card-shadow-light">
                <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50">
                  <TableHead className="py-4 font-black text-slate-500 first:pl-6">
                    产品编码
                  </TableHead>
                  <TableHead className="py-4 font-black text-slate-500">
                    产品名称
                  </TableHead>
                  <TableHead className="py-4 font-black text-slate-500">
                    色号
                  </TableHead>
                  <TableHead className="py-4 font-black text-slate-500">
                    批次号
                  </TableHead>
                  <TableHead className="py-4 font-black text-slate-500">
                    规格
                  </TableHead>
                  <TableHead className="py-4 text-right font-black text-slate-500">
                    装箱数
                  </TableHead>
                  <TableHead className="py-4 text-right font-black text-slate-500">
                    重量 (kg)
                  </TableHead>
                  <TableHead className="py-4 font-black text-slate-500">
                    创建时间
                  </TableHead>
                  <TableHead className="py-4 pr-6 text-right font-black text-slate-500">
                    操作
                  </TableHead>
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
                        className="group border-b border-slate-50 transition-colors hover:bg-blue-50/30"
                      >
                        <TableCell className="py-4 pl-6 text-sm font-black tracking-tight text-slate-900 group-hover:text-blue-600">
                          {spec.product?.code || '-'}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-bold text-slate-600">
                          {spec.product?.name || '-'}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-semibold text-slate-500">
                          {spec.variant?.colorCode || '通用'}
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="rounded-md border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-600 uppercase">
                            {spec.batchNumber}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 text-xs font-medium text-slate-400">
                          {spec.product?.specification || '-'}
                        </TableCell>
                        <TableCell className="py-4 text-right text-xs font-bold text-slate-700 tabular-nums">
                          {formatNumber(spec.piecesPerUnit)}
                        </TableCell>
                        <TableCell className="py-4 text-right text-xs font-bold text-slate-700 tabular-nums">
                          {spec.weight
                            ? `${formatNumber(spec.weight, 2)} kg`
                            : '-'}
                        </TableCell>
                        <TableCell className="py-4 text-xs font-medium text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-slate-300" />
                            {formatDate(spec.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 pr-6 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              asChild
                              title="变动流水"
                            >
                              <Link
                                href={`/inventory/batch/${encodeURIComponent(
                                  spec.batchNumber
                                )}/history?productId=${spec.productId}${spec.variantId ? `&variantId=${spec.variantId}` : ''}`}
                                prefetch={false}
                              >
                                <History className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                              onClick={() => onEdit(spec)}
                              title="编辑规格"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => onDelete(spec)}
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
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
        <div className="space-y-3 px-4 py-3 xl:hidden">
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
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="absolute top-0 right-0 p-2">
                  <Badge
                    variant="outline"
                    className="h-5 border-amber-100 bg-amber-50 px-1.5 text-[9px] font-black text-amber-600 uppercase"
                  >
                    {spec.batchNumber}
                  </Badge>
                </div>

                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1 text-[10px] font-black tracking-widest text-slate-400 uppercase">
                      产品编码
                    </div>
                    <div className="text-base font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
                      {spec.product?.code || '-'}
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-600">
                      {spec.product?.name || '-'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-slate-500">
                      色号：{spec.variant?.colorCode || '通用'}
                    </div>
                    <div className="mt-2 text-xs font-medium text-slate-400">
                      规格：{spec.product?.specification || '-'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">
                        装箱数
                      </span>
                      <span className="text-sm font-black text-slate-700 tabular-nums">
                        {formatNumber(spec.piecesPerUnit)} PCS
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase">
                        重量
                      </span>
                      <span className="text-sm font-black text-slate-700 tabular-nums">
                        {spec.weight
                          ? `${formatNumber(spec.weight, 2)} kg`
                          : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
                      <Calendar className="h-3 w-3" />
                      {formatDate(spec.createdAt)}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 rounded-lg bg-slate-100 p-0 text-slate-600 hover:bg-blue-100 hover:text-blue-600"
                        asChild
                      >
                        <Link
                          href={`/inventory/batch/${encodeURIComponent(
                            spec.batchNumber
                          )}/history?productId=${spec.productId}${spec.variantId ? `&variantId=${spec.variantId}` : ''}`}
                          prefetch={false}
                        >
                          <History className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 rounded-lg bg-slate-100 p-0 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                        onClick={() => onEdit(spec)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 w-8 rounded-lg bg-slate-100 p-0 text-slate-600 hover:bg-red-100 hover:text-red-600"
                        onClick={() => onDelete(spec)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
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

'use client';

import { History, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  BatchSpecification,
  BatchSpecificationListResponse,
} from '@/lib/types/batch-specification';
import { formatDateTimeCN } from '@/lib/utils/datetime';
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

  return (
    <Card className="border border-[hsl(var(--color-border-primary))]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
          批次规格列表
        </CardTitle>
        {isFetching && !isLoading ? (
          <span className="text-muted-foreground text-xs">刷新中…</span>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[hsl(var(--color-bg-secondary))]">
              <TableRow>
                <TableHead className="min-w-[160px]">批次号</TableHead>
                <TableHead className="min-w-[220px]">产品信息</TableHead>
                <TableHead className="w-[120px] text-right">每件片数</TableHead>
                <TableHead className="w-[120px] text-right">
                  重量 (kg)
                </TableHead>
                <TableHead className="w-[120px] text-right">
                  厚度 (mm)
                </TableHead>
                <TableHead className="min-w-[160px]">最近更新</TableHead>
                <TableHead className="w-[160px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showSkeleton
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`batch-skeleton-${index}`}>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="ml-auto h-8 w-24" />
                      </TableCell>
                    </TableRow>
                  ))
                : data.map(spec => (
                    <TableRow key={spec.id} className="text-sm">
                      <TableCell className="font-mono text-[hsl(var(--color-primary))]">
                        {spec.batchNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-[hsl(var(--color-text-primary))]">
                            {spec.product?.name ?? '—'}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            编码：{spec.product?.code ?? '—'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-[hsl(var(--color-success))]">
                        {formatNumber(spec.piecesPerUnit)} 片
                      </TableCell>
                      <TableCell className="text-right">
                        {spec.weight !== undefined && spec.weight !== null
                          ? `${formatNumber(spec.weight)} kg`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {spec.thickness !== undefined && spec.thickness !== null
                          ? `${formatNumber(spec.thickness)} mm`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-[hsl(var(--color-text-secondary))]">
                            {formatDateTimeCN(spec.updatedAt)}
                          </span>
                          <Badge variant="outline" className="w-fit">
                            创建于 {formatDateTimeCN(spec.createdAt)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/inventory/batch/${encodeURIComponent(
                                spec.batchNumber
                              )}/history?productId=${spec.productId}`}
                              prefetch={false}
                            >
                              <History className="mr-1 h-4 w-4" />
                              流水
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(spec)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            编辑
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => onDelete(spec)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              {showEmptyState ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="text-muted-foreground py-10 text-center text-sm">
                      暂无批次规格参数记录，请创建新的批次规格。
                    </div>
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
      </CardContent>
    </Card>
  );
}

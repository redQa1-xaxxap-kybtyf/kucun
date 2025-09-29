'use client';

import { Package, User } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  OUTBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_VARIANTS,
  type OutboundType,
} from '@/lib/types/inventory';
import { formatDateTimeCN } from '@/lib/utils/datetime';

interface OutboundRecord {
  id: string;
  recordNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  type: OutboundType;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

interface OutboundRecordsTableProps {
  records: OutboundRecord[];
  isLoading: boolean;
}

export function OutboundRecordsTable({
  records,
  isLoading,
}: OutboundRecordsTableProps) {
  if (isLoading) {
    return (
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="text-sm font-medium">出库记录</span>
          </div>
        </div>
        <div className="p-4">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border bg-card">
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          <span className="text-sm font-medium">
            出库记录 ({records.length} 条)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-9 text-xs">产品编码</TableHead>
              <TableHead className="h-9 text-xs">产品名称</TableHead>
              <TableHead className="h-9 text-xs">出库数量</TableHead>
              <TableHead className="h-9 text-xs">出库类型</TableHead>
              <TableHead className="h-9 text-xs">出库原因</TableHead>
              <TableHead className="h-9 text-xs">操作时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <span className="text-sm">暂无出库记录</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              records.map(record => (
                <TableRow key={record.id} className="h-10">
                  <TableCell className="text-xs font-medium">
                    {record.productCode}
                  </TableCell>
                  <TableCell className="text-xs">
                    {record.productName}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="font-medium">{record.quantity}</span> 片
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant={OUTBOUND_TYPE_VARIANTS[record.type] || 'default'}
                      className="text-xs"
                    >
                      {OUTBOUND_TYPE_LABELS[record.type] || '未知'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {record.reason || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {formatDateTimeCN(record.createdAt)}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

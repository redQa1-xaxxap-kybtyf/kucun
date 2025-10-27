'use client';

import { CheckCircle, Clock, DollarSign } from 'lucide-react';
import * as React from 'react';

import { EmptyState } from '@/components/common/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  PAYABLE_SOURCE_TYPE_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYABLE_STATUS_VARIANTS,
  type PayableRecordDetail,
} from '@/lib/types/payable';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatCurrency } from '@/lib/utils/format';

interface Props {
  items: PayableRecordDetail[];
  isLoading: boolean;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
}

function TitleSection({ payable }: { payable: PayableRecordDetail }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-900">
          {payable.supplier?.name ?? '未知供应商'}
        </span>
        <Badge variant={PAYABLE_STATUS_VARIANTS[payable.status] || 'secondary'}>
          {PAYABLE_STATUS_LABELS[payable.status]}
        </Badge>
      </div>
      {payable.sourceType && (
        <div className="text-muted-foreground text-xs">
          来源：{PAYABLE_SOURCE_TYPE_LABELS[payable.sourceType]}
        </div>
      )}
    </div>
  );
}

function AmountsSection({ payable }: { payable: PayableRecordDetail }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-orange-500" />
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">应付金额</p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(payable.payableAmount)}</p>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">已付金额</p>
        </div>
        <p className="text-2xl font-bold text-green-600">{formatCurrency(payable.paidAmount)}</p>
        {payable.paidAmount > 0 && (
          <p className="text-xs text-gray-500">
            已付 {(payable.payableAmount ? (payable.paidAmount / payable.payableAmount) * 100 : 0).toFixed(1)}%
          </p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-500" />
          <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">待付金额</p>
        </div>
        <p className="text-2xl font-bold text-amber-600">{formatCurrency(payable.remainingAmount)}</p>
        {payable.remainingAmount > 0 && (
          <p className="text-xs text-gray-500">
            剩余 {(payable.payableAmount ? (payable.remainingAmount / payable.payableAmount) * 100 : 0).toFixed(1)}%
          </p>
        )}
      </div>
    </div>
  );
}

function FooterSection({
  payable,
  onView,
  onPayNow,
}: {
  payable: PayableRecordDetail;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        {payable.sourceNumber && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">来源单号</span>
            <span className="font-medium text-gray-700">{payable.sourceNumber}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>创建时间</span>
          <span className="font-medium">
            {formatDateTime(payable.createdAt, 'yyyy-MM-dd HH:mm')}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onView(payable.id)}
          className="transition-colors hover:bg-gray-50"
        >
          查看详情
        </Button>
        {payable.remainingAmount > 0 && (
          <Button
            size="sm"
            onClick={() => onPayNow(payable.id)}
            className="bg-orange-600 transition-colors hover:bg-orange-700"
          >
            立即付款
          </Button>
        )}
      </div>
    </div>
  );
}

function PayableListItem({
  payable,
  onView,
  onPayNow,
}: {
  payable: PayableRecordDetail;
  onView: (id: string) => void;
  onPayNow: (id: string) => void;
}) {
  return (
    <Card key={payable.id} className="border border-gray-200">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TitleSection payable={payable} />
          <AmountsSection payable={payable} />
        </div>

        {/* 分隔线 */}
        <div className="my-4 border-t border-gray-100" />

        <FooterSection payable={payable} onView={onView} onPayNow={onPayNow} />
      </CardContent>
    </Card>
  );
}

export function PayableList({ items, isLoading, onView, onPayNow }: Props) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="text-muted-foreground h-8 w-8" />}
        title="暂无应付款记录"
        compact
      />
    );
  }

  return (
    <div className="space-y-4">
      {items.map(payable => (
        <PayableListItem
          key={payable.id}
          payable={payable}
          onView={onView}
          onPayNow={onPayNow}
        />
      ))}
    </div>
  );
}

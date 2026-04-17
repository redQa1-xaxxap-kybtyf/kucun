'use client';

import { Truck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  SALES_ORDER_TYPE_LABELS,
  TRANSFER_MODE_LABELS,
} from '@/lib/types/sales-order';

import type { SalesOrderDetail } from './types';

export function TransferModeInfoCard({ order }: { order: SalesOrderDetail }) {
  if (order.orderType !== 'TRANSFER') return null;

  return (
    <Card className="overflow-hidden rounded-2xl border-amber-200 bg-white shadow-sm ring-1 ring-amber-100/50">
      <div className="flex bg-amber-50/50 p-5">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/20">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div className="ml-5 flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-amber-900">
              {SALES_ORDER_TYPE_LABELS.TRANSFER}履约说明
            </h3>
            <Badge
              variant="outline"
              className="border-amber-300 bg-white text-[10px] font-semibold text-amber-700"
            >
              {order.transferMode === 'MIXED'
                ? TRANSFER_MODE_LABELS.MIXED
                : TRANSFER_MODE_LABELS.SUPPLIER_ONLY}
            </Badge>
          </div>
          <div className="mt-3 space-y-2 text-xs font-medium text-amber-800">
            {order.transferMode === 'MIXED' ? (
              <p className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-semibold text-white">
                  ✓
                </span>
                <span>
                  当前处于 <strong>{TRANSFER_MODE_LABELS.MIXED}</strong>{' '}
                  模式：系统将根据库存策略自动拆分本地仓与供应商发货计划。
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-semibold text-white">
                  !
                </span>
                <span>
                  当前处于{' '}
                  <strong>{TRANSFER_MODE_LABELS.SUPPLIER_ONLY}</strong>{' '}
                  模式：所有产品线均关联至外部供应商，本地不执行库存扣减。
                </span>
              </p>
            )}
            <div className="ml-6 flex items-center gap-2 text-[11px] text-amber-700">
              <span className="font-bold tracking-tighter opacity-70">
                指定的履约供应商:
              </span>
              <span className="rounded bg-amber-100/50 px-2 py-0.5 font-semibold">
                {order.supplier?.name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

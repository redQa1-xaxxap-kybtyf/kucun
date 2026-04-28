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
    <Card className="overflow-hidden rounded-md border border-amber-200 bg-white shadow-sm">
      <div className="flex bg-amber-50 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-amber-500">
          <Truck className="h-5 w-5 text-white" />
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
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-600 text-[10px] font-semibold text-white">
                  ✓
                </span>
                <span>
                  当前处于 <strong>{TRANSFER_MODE_LABELS.MIXED}</strong>{' '}
                  模式：系统将根据库存策略自动拆分本地仓与供应商发货计划。
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <span className="flex h-4 w-4 items-center justify-center rounded-md bg-amber-600 text-[10px] font-semibold text-white">
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
              <span className="font-bold opacity-70">
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

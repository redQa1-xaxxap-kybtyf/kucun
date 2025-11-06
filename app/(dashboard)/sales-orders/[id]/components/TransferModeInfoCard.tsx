'use client';

import { Truck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TRANSFER_MODE_LABELS } from '@/lib/types/sales-order';

import type { SalesOrderDetail } from './types';

export function TransferModeInfoCard({ order }: { order: SalesOrderDetail }) {
  if (order.orderType !== 'TRANSFER') return null;

  const getTransferModeBadge = (mode: string | undefined) => {
    const label =
      mode === 'MIXED'
        ? TRANSFER_MODE_LABELS.MIXED
        : TRANSFER_MODE_LABELS.SUPPLIER_ONLY;
    return mode === 'MIXED' ? (
      <Badge
        variant="outline"
        className="border-sky-200 bg-sky-50 text-sky-700"
      >
        {label}
      </Badge>
    ) : (
      <Badge
        variant="outline"
        className="border-amber-200 bg-amber-50 text-amber-700"
      >
        {label}
      </Badge>
    );
  };

  return (
    <Card className="border-l-4 border-amber-500 bg-gradient-to-r from-amber-50 to-orange-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-900">调货销售订单</h3>
              {getTransferModeBadge(order.transferMode)}
            </div>
            <div className="space-y-1 text-xs text-amber-800">
              {order.transferMode === 'MIXED' ? (
                <>
                  <p className="flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-white">
                      ✓
                    </span>
                    <span>
                      <strong>混合发货模式:</strong>{' '}
                      部分产品从本地仓库发货,部分由供应商直接发货
                    </span>
                  </p>
                  <p className="ml-5.5 text-amber-700">
                    供应商: <strong>{order.supplier?.name}</strong>
                  </p>
                </>
              ) : (
                <>
                  <p className="flex items-center gap-1.5">
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 text-[10px] font-bold text-white">
                      !
                    </span>
                    <span>
                      <strong>纯调货模式:</strong> 所有产品均由供应商直接发货
                    </span>
                  </p>
                  <p className="ml-5.5 text-amber-700">
                    供应商: <strong>{order.supplier?.name}</strong>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  History,
  Package,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCurrency } from '@/lib/utils';

import type { CustomerReturnOrder, CustomerSalesOrder } from './types';

interface CustomerActivityTabsProps {
  salesOrders: CustomerSalesOrder[];
  returnOrders: CustomerReturnOrder[];
  unpaidOrders: CustomerSalesOrder[];
  formatDateTime: (value: string) => string;
  onNavigateToOrder: (orderId: string) => void;
  onNavigateToReturnOrder: (orderId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  confirmed: '已确认',
  shipped: '已发货',
  delivered: '已交付',
  completed: '交易成功',
  cancelled: '已取消',
  pending: '处理中',
  approved: '审核通过',
  rejected: '已拒绝',
};

function getOrderStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function CustomerActivityTabs({
  salesOrders,
  returnOrders,
  unpaidOrders,
  formatDateTime,
  onNavigateToOrder,
  onNavigateToReturnOrder,
}: CustomerActivityTabsProps) {
  return (
    <Tabs defaultValue="sales" className="w-full">
      <div className="mb-4 overflow-x-auto">
        <TabsList className="h-10 rounded-lg border bg-slate-50 p-1">
          <TabsTrigger
            value="sales"
            className="h-8 rounded-md px-3 text-sm font-medium data-[state=active]:bg-white"
          >
            销售记录
          </TabsTrigger>
          <TabsTrigger
            value="returns"
            className="h-8 rounded-md px-3 text-sm font-medium data-[state=active]:bg-white"
          >
            退货记录
          </TabsTrigger>
          <TabsTrigger
            value="unpaid"
            className="h-8 rounded-md px-3 text-sm font-medium data-[state=active]:bg-white"
          >
            待收款 ({unpaidOrders.length})
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="sales" className="mt-0 focus-visible:outline-none">
        {salesOrders.length > 0 ? (
          <div className="grid gap-4">
            {salesOrders.map(order => (
              <OrderCard
                key={order.id}
                orderNumber={order.orderNumber}
                status={order.status}
                createdAt={order.createdAt}
                amount={order.totalAmount}
                formatDateTime={formatDateTime}
                onClick={() => onNavigateToOrder(order.id)}
                icon={<Package className="h-4 w-4" />}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="该客户尚无销售成交记录" />
        )}
      </TabsContent>

      <TabsContent value="returns" className="mt-0 focus-visible:outline-none">
        {returnOrders.length > 0 ? (
          <div className="grid gap-4">
            {returnOrders.map(order => (
              <OrderCard
                key={order.id}
                orderNumber={order.returnNumber}
                status={order.status}
                createdAt={order.createdAt}
                amount={order.totalAmount}
                amountPrefix="-"
                amountClass="text-rose-600"
                formatDateTime={formatDateTime}
                onClick={() => onNavigateToReturnOrder(order.id)}
                icon={<History className="h-4 w-4" />}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="该客户暂无退货记录" />
        )}
      </TabsContent>

      <TabsContent value="unpaid" className="mt-0 focus-visible:outline-none">
        {unpaidOrders.length > 0 ? (
          <div className="grid gap-4">
            {unpaidOrders.map(order => {
              const unpaidAmount = order.totalAmount - order.paidAmount;
              return (
                <UnpaidOrderCard
                  key={order.id}
                  orderNumber={order.orderNumber}
                  createdAt={order.createdAt}
                  unpaidAmount={unpaidAmount}
                  formatDateTime={formatDateTime}
                  onClick={() => onNavigateToOrder(order.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState message="当前没有待收款订单" />
        )}
      </TabsContent>
    </Tabs>
  );
}

function OrderCard({
  orderNumber,
  status,
  createdAt,
  amount,
  amountPrefix = '',
  amountClass,
  formatDateTime,
  onClick,
  icon,
}: {
  orderNumber: string;
  status: string;
  createdAt: string;
  amount: number;
  amountPrefix?: string;
  amountClass?: string;
  formatDateTime: (value: string) => string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border bg-white p-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-900">
              #{orderNumber}
            </span>
            <div
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-bold',
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500'
              )}
            >
              {getOrderStatusLabel(status)}
            </div>
          </div>
          <p className="text-xs text-slate-500">{formatDateTime(createdAt)}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-left sm:text-right">
          <p
            className={cn(
              'text-base font-semibold text-slate-900',
              amountClass
            )}
          >
            {amountPrefix}
            {formatCurrency(amount)}
          </p>
          <span className="text-xs text-slate-400">金额</span>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  );
}

function UnpaidOrderCard({
  orderNumber,
  createdAt,
  unpaidAmount,
  formatDateTime,
  onClick,
}: {
  orderNumber: string;
  createdAt: string;
  unpaidAmount: number;
  formatDateTime: (value: string) => string;
  onClick: () => void;
}) {
  return (
    <div
      className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4 transition-colors hover:bg-white sm:flex-row sm:items-center sm:justify-between"
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-500">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-rose-900">
              #{orderNumber}
            </span>
            <div className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              待收款
            </div>
          </div>
          <p className="text-xs text-slate-500">
            开单时间：{formatDateTime(createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <div className="text-left sm:text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-xs font-semibold text-rose-400">¥</span>
            <p className="text-base font-semibold text-rose-600">
              {formatCurrency(unpaidAmount).replace('¥', '')}
            </p>
          </div>
          <p className="text-xs text-slate-400">待收金额</p>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10">
      <CheckCircle2 className="mb-4 h-10 w-10 text-slate-200" />
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}

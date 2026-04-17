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
      <div className="mb-8 flex items-center justify-between px-2">
        <TabsList className="h-14 rounded-2xl border border-slate-200/50 bg-slate-100/50 p-1.5">
          <TabsTrigger
            value="sales"
            className="h-10 rounded-xl px-6 font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-xl"
          >
            销售记录
          </TabsTrigger>
          <TabsTrigger
            value="returns"
            className="h-10 rounded-xl px-6 font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-xl"
          >
            退货记录
          </TabsTrigger>
          <TabsTrigger
            value="unpaid"
            className="h-10 rounded-xl px-6 font-semibold transition-all data-[state=active]:bg-rose-500 data-[state=active]:text-white data-[state=active]:shadow-xl"
          >
            应收账款 ({unpaidOrders.length})
          </TabsTrigger>
        </TabsList>

        <div className="hidden items-center gap-2 text-xs font-bold text-slate-400 md:flex">
          <History className="h-3.5 w-3.5" />
          持续更新
        </div>
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
      className="group relative flex cursor-pointer items-center justify-between rounded-2xl border border-white bg-white/40 p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-xl"
      onClick={onClick}
    >
      <div className="flex items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-all duration-500 group-hover:bg-slate-900 group-hover:text-white">
          {icon}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
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
          <p className="text-xs font-bold text-slate-500">
            {formatDateTime(createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <p
            className={cn(
              'text-lg font-semibold tracking-tighter text-slate-900',
              amountClass
            )}
          >
            {amountPrefix}
            {formatCurrency(amount)}
          </p>
          <span className="text-xs font-bold text-slate-400">
            金额
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-200 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
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
      className="group relative flex cursor-pointer items-center justify-between rounded-2xl border-rose-100 bg-rose-50/20 p-5 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-white hover:shadow-xl"
      onClick={onClick}
    >
      <div className="flex items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-500 transition-all duration-500 group-hover:bg-rose-500 group-hover:text-white">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-rose-900">
              #{orderNumber}
            </span>
            <div className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
              待收款
            </div>
          </div>
          <p className="text-xs font-bold text-slate-500">
            开单时间：{formatDateTime(createdAt)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1">
            <span className="text-xs font-semibold text-rose-400">¥</span>
            <p className="text-lg font-semibold tracking-tighter text-rose-600">
              {formatCurrency(unpaidAmount).replace('¥', '')}
            </p>
          </div>
          <p className="text-xs font-bold text-slate-400">
            待收金额
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-200 transition-all group-hover:translate-x-1 group-hover:text-slate-900" />
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-slate-200 bg-slate-50/50 py-20">
      <CheckCircle2 className="mb-4 h-10 w-10 text-slate-200" />
      <p className="text-sm font-semibold text-slate-400">
        {message}
      </p>
    </div>
  );
}

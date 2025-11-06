'use client';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import {
  getReturnOrderStatusBadgeVariant,
  getSalesOrderStatusBadgeVariant,
} from '@/lib/utils/badge-helpers';

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
  completed: '已完成',
  cancelled: '已取消',
  pending: '待处理',
  approved: '已通过',
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
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="sales">销售订单</TabsTrigger>
        <TabsTrigger value="returns">退货订单</TabsTrigger>
        <TabsTrigger value="unpaid">
          <span>未付款 ({unpaidOrders.length})</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="sales" className="mt-2 space-y-1.5">
        {salesOrders.length > 0 ? (
          <div className="space-y-1.5">
            {salesOrders.map(order => (
              <OrderCard
                key={order.id}
                orderNumber={order.orderNumber}
                status={order.status}
                createdAt={order.createdAt}
                amount={order.totalAmount}
                statusVariant={getSalesOrderStatusBadgeVariant(order.status)}
                formatDateTime={formatDateTime}
                onClick={() => onNavigateToOrder(order.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="暂无销售订单" />
        )}
      </TabsContent>

      <TabsContent value="returns" className="mt-2 space-y-1.5">
        {returnOrders.length > 0 ? (
          <div className="space-y-1.5">
            {returnOrders.map(order => (
              <OrderCard
                key={order.id}
                orderNumber={order.returnNumber}
                status={order.status}
                createdAt={order.createdAt}
                amount={order.totalAmount}
                amountPrefix="-"
                amountClass="text-red-600"
                statusVariant={getReturnOrderStatusBadgeVariant(order.status)}
                formatDateTime={formatDateTime}
                onClick={() => onNavigateToReturnOrder(order.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="暂无退货订单" />
        )}
      </TabsContent>

      <TabsContent value="unpaid" className="mt-2 space-y-1.5">
        {unpaidOrders.length > 0 ? (
          <div className="space-y-1.5">
            {unpaidOrders.map(order => {
              const unpaidAmount = order.totalAmount - order.paidAmount;
              return (
                <UnpaidOrderCard
                  key={order.id}
                  orderNumber={order.orderNumber}
                  status={order.status}
                  createdAt={order.createdAt}
                  totalAmount={order.totalAmount}
                  paidAmount={order.paidAmount}
                  unpaidAmount={unpaidAmount}
                  formatDateTime={formatDateTime}
                  onClick={() => onNavigateToOrder(order.id)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState message="暂无未付款订单" />
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
  statusVariant,
  formatDateTime,
  onClick,
}: {
  orderNumber: string;
  status: string;
  createdAt: string;
  amount: number;
  amountPrefix?: string;
  amountClass?: string;
  statusVariant:
    | 'default'
    | 'secondary'
    | 'destructive'
    | 'outline'
    | 'success'
    | 'warning'
    | 'info';
  formatDateTime: (value: string) => string;
  onClick: () => void;
}) {
  return (
    <div
      className="group hover:border-primary cursor-pointer rounded-lg border p-2.5 transition-all hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold">{orderNumber}</p>
            <Badge variant={statusVariant} className="text-xs">
              {getOrderStatusLabel(status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatDateTime(createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-semibold ${amountClass}`}>
            {amountPrefix}
            {formatCurrency(amount)}
          </p>
        </div>
      </div>
    </div>
  );
}

function UnpaidOrderCard({
  orderNumber,
  status,
  createdAt,
  totalAmount,
  paidAmount,
  unpaidAmount,
  formatDateTime,
  onClick,
}: {
  orderNumber: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  formatDateTime: (value: string) => string;
  onClick: () => void;
}) {
  return (
    <div
      className="group hover:border-primary cursor-pointer rounded-lg border border-orange-200 bg-orange-50/40 p-2.5 transition-all hover:bg-orange-50 hover:shadow-sm"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-mono text-sm font-semibold">{orderNumber}</p>
            <Badge variant="outline" className="text-xs">
              {getOrderStatusLabel(status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatDateTime(createdAt)}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-muted-foreground">
            总额: {formatCurrency(totalAmount)}
          </p>
          <p className="text-green-600">已付: {formatCurrency(paidAmount)}</p>
          <p className="font-semibold text-orange-600">
            欠款: {formatCurrency(unpaidAmount)}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-muted-foreground py-8 text-center text-sm">
      {message}
    </div>
  );
}

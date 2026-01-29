'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, ShoppingCart, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { ContentLoading } from '@/components/common/loading';
import { CustomerActivityTabs } from '@/components/customers/customer-detail/customer-activity-tabs';
import { CustomerContactCard } from '@/components/customers/customer-detail/customer-contact-card';
import { CustomerStatsGrid } from '@/components/customers/customer-detail/customer-stats-grid';
import type {
  CustomerDetail,
  CustomerExtendedInfo,
} from '@/components/customers/customer-detail/types';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';
import { formatDateTime } from '@/lib/utils/datetime';
import { getErrorMessage } from '@/lib/utils/error-handler';

async function fetchCustomerDetail(id: string): Promise<CustomerDetail> {
  const response = await fetch(`/api/customers/${id}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('获取客户详情失败');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error || '获取客户详情失败');
  }

  return result.data;
}

function parseExtendedInfo(raw?: string): CustomerExtendedInfo {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as CustomerExtendedInfo;
  } catch (error) {
    logger.error('Failed to parse extendedInfo:', error);
    return {};
  }
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const {
    data: customer,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => fetchCustomerDetail(id),
    enabled: !!id,
  });

  // 设置动态面包屑标题：显示客户名称
  useBreadcrumbTitle(customer ? customer.name : null);

  if (isLoading) {
    return <ContentLoading />;
  }

  if (error) {
    return (
      <ErrorMessage
        title="加载失败"
        message={getErrorMessage(error)}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!customer) {
    return (
      <ErrorMessage
        title="客户不存在"
        message="未找到指定的客户"
        onRetry={() => router.push('/customers')}
      />
    );
  }

  return <CustomerDetailContent customer={customer} />;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  active: '活跃',
  inactive: '非活跃',
  blacklisted: '黑名单',
};

function getStatusLabel(status: string) {
  return STATUS_LABEL_MAP[status] ?? status;
}

function CustomerHeader({
  customer,
  onEdit,
}: {
  customer: CustomerDetail;
  onEdit: () => void;
}) {
  const router = useRouter();

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] border border-white bg-white/60 p-8 shadow-sm backdrop-blur-xl transition-all duration-500 hover:shadow-xl">
      <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-50/50 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-50/30 blur-3xl" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-900 text-white shadow-2xl transition-transform duration-500 hover:scale-110">
            <User className="h-10 w-10" />
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tighter text-slate-900">
                {customer.name}
              </h1>
              <div
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-bold tracking-wider uppercase',
                  customer.status === 'active'
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {getStatusLabel(customer.status)}账户
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <span className="text-xs tracking-wider text-slate-500 uppercase">
                  档案编号
                </span>
                <span className="font-bold text-slate-600">
                  {customer.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <span className="h-1 w-1 rounded-full bg-slate-200" />
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <span className="text-xs tracking-wider text-slate-500 uppercase">
                  合作始于
                </span>
                <span className="font-bold text-slate-600">
                  {formatDateTime(customer.createdAt).split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="lg"
            onClick={onEdit}
            className="h-14 rounded-2xl border-none bg-white px-8 font-black text-slate-600 shadow-sm transition-all hover:bg-slate-900 hover:text-white active:scale-95"
          >
            <Edit className="mr-2 h-5 w-5" />
            修订档案
          </Button>
          <Button
            size="lg"
            className="h-14 rounded-2xl bg-slate-900 px-10 font-black text-white shadow-xl transition-all hover:shadow-slate-200 active:scale-95"
            onClick={() =>
              router.push(`/sales-orders/create?customerId=${customer.id}`)
            }
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            快速建立订单
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailContent({ customer }: { customer: CustomerDetail }) {
  const router = useRouter();

  const totalSalesAmount = useMemo(
    () =>
      customer.salesOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    [customer.salesOrders]
  );

  const totalReturnAmount = useMemo(
    () =>
      customer.returnOrders.reduce((sum, order) => sum + order.totalAmount, 0),
    [customer.returnOrders]
  );

  const unpaidOrders = useMemo(
    () =>
      customer.salesOrders.filter(
        order =>
          order.paidAmount < order.totalAmount && order.status !== 'cancelled'
      ),
    [customer.salesOrders]
  );

  const totalUnpaidAmount = useMemo(
    () =>
      unpaidOrders.reduce(
        (sum, order) => sum + (order.totalAmount - order.paidAmount),
        0
      ),
    [unpaidOrders]
  );

  const extendedInfo = useMemo(
    () => parseExtendedInfo(customer.extendedInfo),
    [customer.extendedInfo]
  );

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 transition-all duration-500 lg:p-10 xl:p-14">
        <CustomerHeader
          customer={customer}
          onEdit={() => router.push(`/customers/${customer.id}/edit`)}
        />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <CustomerContactCard
              phone={customer.phone}
              address={customer.address}
              extendedInfo={extendedInfo}
              createdAt={customer.createdAt}
              updatedAt={customer.updatedAt}
              formatDateTime={formatDateTime}
            />
          </div>
          <div className="lg:col-span-1">
            <CustomerStatsGrid
              totalSalesAmount={totalSalesAmount}
              totalReturnAmount={totalReturnAmount}
              totalUnpaidAmount={totalUnpaidAmount}
              salesOrderCount={customer._count.salesOrders}
              returnOrderCount={customer._count.returnOrders}
              unpaidOrderCount={unpaidOrders.length}
            />
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-white bg-white/40 p-1 shadow-sm backdrop-blur-md">
          <div className="p-8 pb-4">
            <h2 className="text-2xl font-black tracking-tight text-slate-900">
              往来审计与近期活动
            </h2>
            <p className="mt-1 text-sm font-bold text-slate-400">
              追踪未结订单、历史销售及退货的完整生命周期。
            </p>
          </div>
          <div className="p-2">
            <CustomerActivityTabs
              salesOrders={customer.salesOrders}
              returnOrders={customer.returnOrders}
              unpaidOrders={unpaidOrders}
              formatDateTime={formatDateTime}
              onNavigateToOrder={orderId =>
                router.push(`/sales-orders/${orderId}`)
              }
              onNavigateToReturnOrder={orderId =>
                router.push(`/return-orders/${orderId}`)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

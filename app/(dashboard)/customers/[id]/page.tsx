'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, ShoppingCart, User } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { useBreadcrumbTitle } from '@/components/common/BreadcrumbContext';
import { ContentLoading } from '@/components/common/loading';
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
import {
  getCurrentPathWithSearch,
  withReturnTo,
} from '@/lib/utils/sales-order-navigation';

const CustomerActivityTabs = dynamic(
  () =>
    import(
      '@/components/customers/customer-detail/customer-activity-tabs'
    ).then(mod => mod.CustomerActivityTabs),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground p-8 text-sm">活动加载中...</div>
    ),
  }
);

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
    <div className="rounded-lg border bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4 sm:items-center">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <User className="h-6 w-6" />
          </div>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-semibold text-slate-900 sm:text-2xl">
                {customer.name}
              </h1>
              <div
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  customer.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {getStatusLabel(customer.status)}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>客户编号</span>
                <span className="font-mono font-medium text-slate-700">
                  {customer.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>建档时间</span>
                <span className="font-medium text-slate-700">
                  {formatDateTime(customer.createdAt).split(' ')[0]}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            variant="outline"
            onClick={onEdit}
            className="h-10 rounded-lg"
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑资料
          </Button>
          <Button
            className="h-10 rounded-lg"
            onClick={() =>
              router.push(
                withReturnTo(
                  `/sales-orders/create?customerId=${customer.id}`,
                  getCurrentPathWithSearch() ?? `/customers/${customer.id}`
                )
              )
            }
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            新建销售订单
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
    <div className="min-h-screen bg-[hsl(var(--color-bg-primary))]">
      <div className="mx-auto max-w-[1680px] space-y-4 p-4 sm:space-y-5 lg:p-8 xl:p-10">
        <CustomerHeader
          customer={customer}
          onEdit={() => router.push(`/customers/${customer.id}/edit`)}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 xl:col-span-9">
            <CustomerContactCard
              phone={customer.phone}
              address={customer.address}
              extendedInfo={extendedInfo}
              createdAt={customer.createdAt}
              updatedAt={customer.updatedAt}
              formatDateTime={formatDateTime}
            />
          </div>
          <div className="lg:col-span-4 xl:col-span-3">
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

        <div className="rounded-lg border bg-white">
          <div className="border-b p-4 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
              业务往来与近期记录
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              集中查看销售、退货和待收款情况
            </p>
          </div>
          <div className="p-4 sm:p-5">
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

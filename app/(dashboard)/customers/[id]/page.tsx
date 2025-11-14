'use client';

import { useQuery } from '@tanstack/react-query';
import { Edit, ShoppingCart, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { ContentLoading } from '@/components/common/loading';
import { PageHeader } from '@/components/common/page-header';
import { CustomerActivityTabs } from '@/components/customers/customer-detail/customer-activity-tabs';
import { CustomerContactCard } from '@/components/customers/customer-detail/customer-contact-card';
import { CustomerStatsGrid } from '@/components/customers/customer-detail/customer-stats-grid';
import type {
  CustomerDetail,
  CustomerExtendedInfo,
} from '@/components/customers/customer-detail/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorMessage } from '@/components/ui/error-message';
import { queryKeys } from '@/lib/queryKeys';
import { getCommonStatusBadgeVariant } from '@/lib/utils/badge-helpers';
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
  return (
    <PageHeader
      title={customer.name}
      description={
        <div className="flex items-center gap-2">
          <Badge variant={getCommonStatusBadgeVariant(customer.status)}>
            {getStatusLabel(customer.status)}
          </Badge>
          {customer.phone && (
            <span className="text-sm text-[hsl(var(--color-text-secondary))]">
              {customer.phone}
            </span>
          )}
        </div>
      }
      icon={<User className="h-6 w-6 text-white" />}
      iconBgColor="hsl(var(--color-purple))"
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onEdit} className="h-9">
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button size="sm" className="h-9">
            <ShoppingCart className="mr-2 h-4 w-4" />
            创建订单
          </Button>
        </>
      }
    />
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
    <div className="flex h-full flex-col overflow-auto p-4">
      <div className="space-y-4">
        <CustomerHeader
          customer={customer}
          onEdit={() => router.push(`/customers/${customer.id}/edit`)}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CustomerContactCard
              phone={customer.phone}
              address={customer.address}
              extendedInfo={extendedInfo}
              createdAt={customer.createdAt}
              updatedAt={customer.updatedAt}
              formatDateTime={formatDateTime}
            />
          </div>
          <CustomerStatsGrid
            totalSalesAmount={totalSalesAmount}
            totalReturnAmount={totalReturnAmount}
            totalUnpaidAmount={totalUnpaidAmount}
            salesOrderCount={customer._count.salesOrders}
            returnOrderCount={customer._count.returnOrders}
            unpaidOrderCount={unpaidOrders.length}
          />
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">近期订单与退货</h2>
                <p className="text-muted-foreground text-sm">
                  优先关注未付款订单，查看历史销售与退货记录
                </p>
              </div>
            </div>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

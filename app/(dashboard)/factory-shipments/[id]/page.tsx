import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { Suspense } from 'react';

import { FactoryShipmentOrderDetailSkeleton } from '@/components/factory-shipments/factory-shipment-order-detail-skeleton';
import { FactoryShipmentOrderDetailWrapper } from '@/components/factory-shipments/factory-shipment-order-detail-wrapper';
import { factoryShipmentQueryKeys } from '@/lib/api/factory-shipments';
import { getFactoryShipmentOrderServer } from '@/lib/api/factory-shipments-server';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * 厂家发货订单详情页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 * 服务端组件 - 优先使用 App Router SSR，在服务端预取数据
 */
export default async function FactoryShipmentDetailPage({
  params,
}: PageProps) {
  const { id } = await params;

  // 创建 QueryClient 用于服务端预取
  const queryClient = new QueryClient();

  // 预取订单详情数据
  await queryClient.prefetchQuery({
    queryKey: factoryShipmentQueryKeys.detail(id),
    queryFn: () => getFactoryShipmentOrderServer(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <Suspense fallback={<FactoryShipmentOrderDetailSkeleton />}>
          <FactoryShipmentOrderDetailWrapper orderId={id} />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}

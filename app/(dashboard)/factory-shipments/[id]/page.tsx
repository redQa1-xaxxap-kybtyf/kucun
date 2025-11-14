import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';

import { FactoryShipmentOrderDetailWrapper } from '@/components/factory-shipments/factory-shipment-order-detail-wrapper';
import { getFactoryShipmentOrderServer } from '@/lib/api/factory-shipments-server';
import { queryKeys } from '@/lib/queryKeys';

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * 厂家发货订单详情页面
 * 采用中国ERP系统标准布局，严格遵循全栈项目统一约定规范
 * 服务端组件 - 优先使用 App Router SSR，在服务端预取数据
 *
 * ✅ Next.js 15 最佳实践：
 * - Route Segment Config 配置
 * - Server Component 数据预取
 * - TanStack Query HydrationBoundary
 */

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;
export default async function FactoryShipmentDetailPage({ params }: PageProps) {
  const { id } = await params;

  // 创建 QueryClient 用于服务端预取
  const queryClient = new QueryClient();

  // 预取订单详情数据
  await queryClient.prefetchQuery({
    queryKey: queryKeys.factoryShipments.detail(id),
    queryFn: () => getFactoryShipmentOrderServer(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <FactoryShipmentOrderDetailWrapper orderId={id} />
    </HydrationBoundary>
  );
}

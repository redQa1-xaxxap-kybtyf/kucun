import { PageLoading } from '@/components/common/loading';

/**
 * 厂家发货订单页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function FactoryShipmentsLoading() {
  return <PageLoading text="加载厂家发货订单..." />;
}

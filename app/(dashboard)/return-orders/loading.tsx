import { PageLoading } from '@/components/common/loading';

/**
 * 退货订单页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function ReturnOrdersLoading() {
  return <PageLoading text="加载退货订单..." />;
}

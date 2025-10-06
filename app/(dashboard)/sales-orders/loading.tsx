import { PageLoading } from '@/components/common/loading';

/**
 * 销售订单页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function SalesOrdersLoading() {
  return <PageLoading text="加载销售订单..." />;
}

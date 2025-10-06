import { PageLoading } from '@/components/common/loading';

/**
 * 产品管理页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function ProductsLoading() {
  return <PageLoading text="加载产品列表..." />;
}

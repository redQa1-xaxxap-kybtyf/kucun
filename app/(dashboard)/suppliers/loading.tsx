import { PageLoading } from '@/components/common/loading';

/**
 * 供应商管理页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function SuppliersLoading() {
  return <PageLoading text="加载供应商列表..." />;
}

import { PageLoading } from '@/components/common/loading';

/**
 * 库存管理页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function InventoryLoading() {
  return <PageLoading text="加载库存数据..." />;
}

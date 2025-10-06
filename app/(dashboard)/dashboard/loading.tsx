import { PageLoading } from '@/components/common/loading';

/**
 * 仪表盘页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function DashboardLoading() {
  return <PageLoading text="加载仪表盘数据..." />;
}

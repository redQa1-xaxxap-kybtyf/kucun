import { PageLoading } from '@/components/common/loading';

/**
 * 首页页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function DashboardLoading() {
  return <PageLoading text="加载首页数据..." />;
}

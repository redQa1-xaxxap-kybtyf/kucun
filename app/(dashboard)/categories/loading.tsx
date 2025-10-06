import { PageLoading } from '@/components/common/loading';

/**
 * 分类管理页面加载状态
 * Next.js 15 自动在页面加载时显示此组件
 */
export default function CategoriesLoading() {
  return <PageLoading text="加载分类列表..." />;
}

import { CategoryListSkeleton } from '@/components/categories/category-list-skeleton';

/**
 * 分类管理页面加载骨架屏
 * Next.js 15 会自动在页面加载时显示此组件
 */
export default function CategoriesLoading() {
  return <CategoryListSkeleton />;
}

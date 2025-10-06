import { ProductListSkeleton } from '@/components/products/product-list-skeleton';

/**
 * 产品管理页面加载骨架屏
 * Next.js 15 会自动在页面加载时显示此组件
 */
export default function ProductsLoading() {
  return <ProductListSkeleton />;
}

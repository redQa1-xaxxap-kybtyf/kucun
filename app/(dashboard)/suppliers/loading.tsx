import { SupplierListSkeleton } from '@/components/suppliers/supplier-list-skeleton';

/**
 * 供应商管理页面加载骨架屏
 * Next.js 15 会自动在页面加载时显示此组件
 */
export default function SuppliersLoading() {
  return <SupplierListSkeleton />;
}

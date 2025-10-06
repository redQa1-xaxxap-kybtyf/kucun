import { CustomerListSkeleton } from '@/components/customers/customer-list-skeleton';

/**
 * 客户管理页面加载骨架屏
 * Next.js 15 会自动在页面加载时显示此组件
 */
export default function CustomersLoading() {
  return <CustomerListSkeleton />;
}

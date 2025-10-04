import { Suspense } from 'react';

import { ReturnOrderListSkeleton } from '@/components/return-orders/return-order-list-skeleton';
import { ReturnOrdersPageClient } from './page-client';

/**
 * 退货订单页面 - Server Component
 * 负责数据获取和 SEO 优化
 * 严格遵循前端架构规范：三级组件架构
 */
export default function ReturnOrdersPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <Suspense fallback={<ReturnOrderListSkeleton />}>
        <ReturnOrdersPageClient />
      </Suspense>
    </div>
  );
}

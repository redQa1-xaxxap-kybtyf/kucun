'use client';

import dynamic from 'next/dynamic';

import { InboundPageHeader } from '@/components/inventory/inbound-page-header';
import { InventoryListSkeleton } from '@/components/ui/skeleton-compositions';
import type { InboundQueryParams } from '@/lib/types/inbound';

const ERPInboundRecords = dynamic(
  () =>
    import('@/components/inventory/erp-inbound-records').then(
      mod => mod.ERPInboundRecords
    ),
  {
    ssr: false,
    loading: () => <InventoryListSkeleton />,
  }
);

/**
 * 入库记录客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 *
 * ✅ 重构：与销售订单页面保持一致的结构
 */
interface InboundRecordsPageClientProps {
  initialParams: InboundQueryParams;
}

export function InboundRecordsPageClient({
  initialParams,
}: InboundRecordsPageClientProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="mb-6 flex-shrink-0">
        <InboundPageHeader />
      </div>
      <div className="flex-1">
        <ERPInboundRecords initialParams={initialParams} />
      </div>
    </div>
  );
}

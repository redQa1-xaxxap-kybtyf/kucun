'use client';

import dynamic from 'next/dynamic';

import { OutboundPageHeader } from '@/components/inventory/outbound-page-header';
import { InventoryListSkeleton } from '@/components/ui/skeleton-compositions';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

const ERPOutboundRecords = dynamic(
  () =>
    import('@/components/inventory/erp-outbound-records').then(
      mod => mod.ERPOutboundRecords
    ),
  {
    ssr: false,
    loading: () => <InventoryListSkeleton />,
  }
);

/**
 * 出库记录客户端组件
 *
 * ✅ 已修复页面标题丢失问题
 * ✅ 结构已与入库页面（Inbound）完成对齐
 */
interface OutboundRecordsPageClientProps {
  initialParams: OutboundRecordQueryParams;
}

export function OutboundRecordsPageClient({
  initialParams,
}: OutboundRecordsPageClientProps) {
  return (
    <div className="flex h-full flex-col overflow-auto p-4 xl:p-6">
      <div className="mb-6 flex-shrink-0">
        <OutboundPageHeader />
      </div>
      <div className="flex-1">
        <ERPOutboundRecords initialParams={initialParams} />
      </div>
    </div>
  );
}

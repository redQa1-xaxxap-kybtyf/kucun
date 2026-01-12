'use client';

import { ERPOutboundRecords } from '@/components/inventory/erp-outbound-records';
import { OutboundPageHeader } from '@/components/inventory/outbound-page-header';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

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
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="mb-6 flex-shrink-0">
        <OutboundPageHeader />
      </div>
      <div className="flex-1">
        <ERPOutboundRecords initialParams={initialParams} />
      </div>
    </div>
  );
}

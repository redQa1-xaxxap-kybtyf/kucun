'use client';

import dynamic from 'next/dynamic';

import { OutboundPageHeader } from '@/components/inventory/outbound-page-header';
import type { OutboundRecordQueryParams } from '@/lib/types/inventory';

const ERPOutboundRecords = dynamic(
  () =>
    import('@/components/inventory/erp-outbound-records').then(
      mod => mod.ERPOutboundRecords
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        列表加载中...
      </div>
    ),
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

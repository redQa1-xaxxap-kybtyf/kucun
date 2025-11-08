'use client';

import { ERPInboundRecords } from '@/components/inventory/erp-inbound-records';
import { InboundPageHeader } from '@/components/inventory/inbound-page-header';
import type { InboundQueryParams } from '@/lib/types/inbound';

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
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="mb-6 flex-shrink-0">
        <InboundPageHeader />
      </div>
      <div className="flex-1">
        <ERPInboundRecords initialParams={initialParams} />
      </div>
    </div>
  );
}

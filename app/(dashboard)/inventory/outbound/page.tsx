'use client';

import { ERPOutboundRecords } from '@/components/inventory/erp-outbound-records';

/**
 * 出库记录页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function OutboundRecordsPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPOutboundRecords />
    </div>
  );
}

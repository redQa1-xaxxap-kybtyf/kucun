'use client';

import { ERPInboundForm } from '@/components/inventory/erp-inbound-form';

/**
 * 产品入库页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 * ✅ 符合产品模块UI风格规范
 */
export default function CreateInboundPage() {
  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <ERPInboundForm />
    </div>
  );
}

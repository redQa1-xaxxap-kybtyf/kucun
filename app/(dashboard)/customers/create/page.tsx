'use client';

import { ERPCustomerForm } from '@/components/customers/erp-customer-form';

/**
 * 新建客户页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CreateCustomerPage() {
  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPCustomerForm mode="create" />
    </div>
  );
}

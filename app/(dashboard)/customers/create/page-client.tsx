'use client';

import dynamic from 'next/dynamic';

const ERPCustomerForm = dynamic(
  () =>
    import('@/components/customers/erp-customer-form').then(
      mod => mod.ERPCustomerForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

export function CreateCustomerPageClient() {
  return <ERPCustomerForm mode="create" presentation="page" />;
}

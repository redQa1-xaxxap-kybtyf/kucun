'use client';

import dynamic from 'next/dynamic';

const ERPInboundForm = dynamic(
  () =>
    import('@/components/inventory/erp-inbound-form').then(
      mod => mod.ERPInboundForm
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

export function ERPInboundFormLazy() {
  return <ERPInboundForm />;
}

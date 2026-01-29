'use client';

import dynamic from 'next/dynamic';

const CreatePaymentPageClient = dynamic(() => import('./page-client'), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
      页面加载中...
    </div>
  ),
});

export default function CreatePaymentPage() {
  return <CreatePaymentPageClient />;
}


'use client';

import dynamic from 'next/dynamic';

const CreateSupplierPageClient = dynamic(() => import('./page-client'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-[420px] animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  ),
});

export default function CreateSupplierPage() {
  return <CreateSupplierPageClient />;
}

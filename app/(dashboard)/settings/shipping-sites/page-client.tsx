'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

interface ShippingSitesPageClientProps {
  isAdmin: boolean;
}

const ShippingSitesAdmin = dynamic(() => import('./shipping-sites-admin'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="text-muted-foreground rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))] p-6 text-sm">
        页面加载中...
      </div>
    </div>
  ),
});

function NoAccess() {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-sm font-semibold text-amber-900">权限不足</h1>
        <p className="mt-2 text-sm text-amber-800">
          只有管理员可以访问运输站点管理功能。
        </p>
        <div className="mt-4">
          <Link
            href="/settings"
            className="inline-flex h-9 items-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            返回设置
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ShippingSitesPageClient({
  isAdmin,
}: ShippingSitesPageClientProps) {
  if (!isAdmin) {
    return <NoAccess />;
  }

  return <ShippingSitesAdmin isAdmin={isAdmin} />;
}

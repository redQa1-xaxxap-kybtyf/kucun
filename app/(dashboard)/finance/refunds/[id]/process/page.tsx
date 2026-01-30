'use client';

import dynamic from 'next/dynamic';
import { use } from 'react';

const RefundProcessForm = dynamic(
  () =>
    import('@/components/finance/refund-process-form').then(
      mod => mod.RefundProcessForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4 p-6">
        <div className="bg-muted h-24 animate-pulse rounded-lg" />
        <div className="bg-muted h-[520px] animate-pulse rounded-lg" />
      </div>
    ),
  }
);

interface RefundProcessPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 退款处理页面
 * 复用统一的退款处理表单
 */
export default function RefundProcessPage({ params }: RefundProcessPageProps) {
  const { id } = use(params);
  return <RefundProcessForm refundId={id} variant="page" />;
}

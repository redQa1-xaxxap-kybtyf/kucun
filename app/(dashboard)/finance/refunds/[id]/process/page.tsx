'use client';

import * as React from 'react';

import { RefundProcessForm } from '@/components/finance/refund-process-form';

interface RefundProcessPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 退款处理页面
 * 复用统一的退款处理表单
 */
export default function RefundProcessPage({ params }: RefundProcessPageProps) {
  const [refundId, setRefundId] = React.useState<string>('');

  React.useEffect(() => {
    params.then(({ id }) => setRefundId(id));
  }, [params]);

  return <RefundProcessForm refundId={refundId} variant="page" />;
}

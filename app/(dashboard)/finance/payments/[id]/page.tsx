/**
 * 收款记录详情页面
 * 显示收款记录的详细信息，包含客户信息、订单信息和操作历史
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPaymentDetailRecord } from '@/lib/services/payment-detail-service';

import { PaymentDetailClient } from './page-client';

interface PaymentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: PaymentDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `收款详情 #${id} - 瓷砖销售 ERP`,
    description: '查看收款详情和关联订单信息',
  };
}

/**
 * 收款记录详情页面组件 - 服务端组件
 */
export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { id } = await params;
  let paymentResult = null;

  try {
    paymentResult = await getPaymentDetailRecord(id);
  } catch {
    paymentResult = null;
  }

  if (!paymentResult) {
    notFound();
  }

  return <PaymentDetailClient initialPayment={paymentResult} />;
}

/**
 * 付款记录详情页面
 * 显示付款记录的详细信息，包含供应商信息、应付账款信息和操作历史
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';

import { PaymentOutDetailClient } from './page-client';

interface PaymentOutDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: PaymentOutDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `付款记录详情 #${id} - 库存管理工具`,
    description: '查看付款记录详细信息和关联应付账款',
  };
}

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    remainingAmount: number;
    status: string;
  };
  supplier: {
    id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取付款记录详情数据
 */
async function getPaymentOutDetail(
  id: string
): Promise<PaymentOutRecord | null> {
  try {
    const payment = await prisma.paymentOutRecord.findUnique({
      where: { id },
      include: {
        payableRecord: {
          select: {
            id: true,
            payableNumber: true,
            payableAmount: true,
            remainingAmount: true,
            status: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!payment || !payment.supplier || !payment.user) {
      return null;
    }

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(payment.actualPaymentAmount),
      roundingAmount: Number(payment.roundingAmount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      remarks: payment.remarks ?? undefined,
      voucherNumber: payment.voucherNumber ?? undefined,
      payableRecord: payment.payableRecord
        ? {
            id: payment.payableRecord.id,
            payableNumber: payment.payableRecord.payableNumber,
            payableAmount: Number(payment.payableRecord.payableAmount),
            remainingAmount: Number(payment.payableRecord.remainingAmount),
            status: payment.payableRecord.status,
          }
        : undefined,
      supplier: {
        id: payment.supplier.id,
        name: payment.supplier.name,
        phone: payment.supplier.phone ?? undefined,
        address: payment.supplier.address ?? undefined,
      },
      user: {
        id: payment.user.id,
        name: payment.user.name,
      },
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * 付款记录详情页面组件 - 服务端组件
 */
export default async function PaymentOutDetailPage({
  params,
}: PaymentOutDetailPageProps) {
  const { id } = await params;
  const paymentResult = await getPaymentOutDetail(id);

  if (!paymentResult) {
    notFound();
  }

  return <PaymentOutDetailClient initialPayment={paymentResult} />;
}

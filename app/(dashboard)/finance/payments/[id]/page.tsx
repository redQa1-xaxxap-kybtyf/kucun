/**
 * 收款记录详情页面
 * 显示收款记录的详细信息，包含客户信息、订单信息和操作历史
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';

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
    title: `收款记录详情 #${id} - 库存管理工具`,
    description: '查看收款记录详细信息和关联订单',
  };
}

interface PaymentRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  actualPaymentAmount: number;
  roundingAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  receiptNumber?: string;
  bankInfo?: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  salesOrder: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  };
  user: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取收款记录详情数据
 */
async function getPaymentDetail(id: string): Promise<PaymentRecord | null> {
  try {
    const payment = await prisma.paymentRecord.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
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

    if (!payment || !payment.customer || !payment.salesOrder || !payment.user) {
      return null;
    }

    // 动态计算该订单的已收款金额(所有已确认的收款记录)
    const confirmedPayments = await prisma.paymentRecord.findMany({
      where: {
        salesOrderId: payment.salesOrderId,
        status: 'confirmed',
      },
      select: {
        paymentAmount: true,
      },
    });

    const orderPaidAmount = confirmedPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    );
    const orderTotalAmount = Number(payment.salesOrder.totalAmount);
    const orderRemainingAmount = orderTotalAmount - orderPaidAmount;

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(
        payment.actualPaymentAmount ?? payment.paymentAmount
      ),
      roundingAmount: Number(payment.roundingAmount ?? 0),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      remarks: payment.remarks ?? undefined,
      receiptNumber: payment.receiptNumber ?? undefined,
      bankInfo: payment.bankInfo ?? undefined,
      customer: {
        id: payment.customer.id,
        name: payment.customer.name,
        phone: payment.customer.phone ?? undefined,
        address: payment.customer.address ?? undefined,
      },
      salesOrder: {
        id: payment.salesOrder.id,
        orderNumber: payment.salesOrder.orderNumber,
        totalAmount: orderTotalAmount,
        paidAmount: orderPaidAmount,
        remainingAmount: orderRemainingAmount,
        status: payment.salesOrder.status,
        createdAt: payment.salesOrder.createdAt.toISOString(),
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
 * 收款记录详情页面组件 - 服务端组件
 */
export default async function PaymentDetailPage({
  params,
}: PaymentDetailPageProps) {
  const { id } = await params;
  const paymentResult = await getPaymentDetail(id);

  if (!paymentResult) {
    notFound();
  }

  return <PaymentDetailClient initialPayment={paymentResult} />;
}

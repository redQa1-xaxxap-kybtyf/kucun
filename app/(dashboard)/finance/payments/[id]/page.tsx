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
  appliedAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  paymentType: string;
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
  salesOrder?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
  } | null;
  user: {
    id: string;
    name: string;
  };
  prepaymentUsages?: Array<{
    id: string;
    salesOrderId?: string;
    orderNumber?: string;
    orderStatus?: string;
    orderCreatedAt?: string;
    appliedAmount: number;
    createdAt: string;
  }>;
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
        prepaymentUsages: {
          include: {
            salesOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!payment || !payment.customer || !payment.user) {
      return null;
    }

    let orderPaidAmount = 0;
    let orderTotalAmount = 0;
    let orderRemainingAmount = 0;

    if (payment.salesOrderId && payment.salesOrder) {
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

      orderPaidAmount = confirmedPayments.reduce(
        (sum, p) => sum + Number(p.paymentAmount),
        0
      );
      orderTotalAmount = Number(payment.salesOrder.totalAmount);
      orderRemainingAmount = orderTotalAmount - orderPaidAmount;
    }

    const prepaymentUsages =
      payment.prepaymentUsages?.map(usage => ({
        id: usage.id,
        salesOrderId: usage.salesOrder?.id ?? undefined,
        orderNumber: usage.salesOrder?.orderNumber ?? undefined,
        orderStatus: usage.salesOrder?.status ?? undefined,
        orderCreatedAt: usage.salesOrder?.createdAt
          ? usage.salesOrder.createdAt.toISOString()
          : undefined,
        appliedAmount: Number(usage.appliedAmount ?? 0),
        createdAt: usage.createdAt.toISOString(),
      })) ?? [];

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentAmount: Number(payment.paymentAmount),
      actualPaymentAmount: Number(
        payment.actualPaymentAmount ?? payment.paymentAmount
      ),
      roundingAmount: Number(payment.roundingAmount ?? 0),
      appliedAmount: Number(payment.appliedAmount ?? 0),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      paymentType: payment.paymentType,
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
        id: payment.salesOrder?.id ?? '',
        orderNumber: payment.salesOrder?.orderNumber ?? '',
        totalAmount: orderTotalAmount,
        paidAmount: orderPaidAmount,
        remainingAmount: orderRemainingAmount,
        status: payment.salesOrder?.status ?? '',
        createdAt: payment.salesOrder?.createdAt
          ? payment.salesOrder.createdAt.toISOString()
          : '',
      } as PaymentRecord['salesOrder'],
      user: {
        id: payment.user.id,
        name: payment.user.name,
      },
      prepaymentUsages,
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

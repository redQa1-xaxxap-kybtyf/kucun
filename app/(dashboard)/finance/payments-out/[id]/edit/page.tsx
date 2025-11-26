/**
 * 编辑付款记录页面
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db';

import { EditPaymentOutClient } from './page-client';

interface EditPaymentOutPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: EditPaymentOutPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `编辑付款记录 #${id} - 库存管理工具`,
    description: '编辑付款记录信息',
  };
}

interface PaymentOutRecord {
  id: string;
  paymentNumber: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  remarks?: string;
  voucherNumber?: string;
  bankInfo?: string;
  payableRecordId?: string | null;
  payableRecord?: {
    id: string;
    payableNumber: string;
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    supplier: {
      id: string;
      name: string;
      phone?: string;
      email?: string;
    };
  };
  supplierId: string;
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
async function getPaymentOutDetail(id: string): Promise<PaymentOutRecord | null> {
  try {
    const payment = await prisma.paymentOutRecord.findUnique({
      where: { id },
      include: {
        payableRecord: {
          include: {
            supplier: true,
          },
        },
        supplier: true,
        user: true,
      },
    });

    if (!payment) {
      return null;
    }

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentAmount: Number(payment.paymentAmount),
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      remarks: payment.remarks ?? undefined,
      voucherNumber: payment.voucherNumber ?? undefined,
      bankInfo: payment.bankInfo ?? undefined,
      payableRecordId: payment.payableRecordId,
      payableRecord: payment.payableRecord
        ? {
            id: payment.payableRecord.id,
            payableNumber: payment.payableRecord.payableNumber,
            payableAmount: Number(payment.payableRecord.payableAmount),
            paidAmount: Number(payment.payableRecord.paidAmount),
            remainingAmount: Number(payment.payableRecord.remainingAmount),
            status: payment.payableRecord.status,
            supplier: {
              id: payment.payableRecord.supplier.id,
              name: payment.payableRecord.supplier.name,
              phone: payment.payableRecord.supplier.phone ?? undefined,
              email: payment.payableRecord.supplier.email ?? undefined,
            },
          }
        : undefined,
      supplierId: payment.supplierId,
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
 * 编辑付款记录页面组件 - 服务端组件
 */
export default async function EditPaymentOutPage({
  params,
}: EditPaymentOutPageProps) {
  const { id } = await params;
  const paymentResult = await getPaymentOutDetail(id);

  if (!paymentResult) {
    notFound();
  }

  return <EditPaymentOutClient initialPayment={paymentResult} />;
}

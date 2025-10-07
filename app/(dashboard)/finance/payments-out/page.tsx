import type { Metadata } from 'next';

import { prisma } from '@/lib/db';

import { PaymentsOutPageClient } from './page-client';

export const metadata: Metadata = {
  title: '付款记录 - 财务管理',
  description: '管理采购订单的付款记录，跟踪付款状态和金额',
};

/**
 * 服务器端获取付款数据
 */
async function getPaymentsOutData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  paymentMethod?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = searchParams.status;
  const paymentMethod = searchParams.paymentMethod;
  const sortBy = searchParams.sortBy || 'createdAt';
  const sortOrder = searchParams.sortOrder || 'desc';

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (search) {
    whereConditions.OR = [
      { paymentNumber: { contains: search } },
      { voucherNumber: { contains: search } },
      { remarks: { contains: search } },
      { supplier: { name: { contains: search } } },
      {
        payableRecord: {
          OR: [
            { payableNumber: { contains: search } },
            { sourceNumber: { contains: search } },
          ],
        },
      },
    ];
  }

  if (status) {
    whereConditions.status = status;
  }

  if (paymentMethod) {
    whereConditions.paymentMethod = paymentMethod;
  }

  // 查询付款记录
  const [payments, total] = await Promise.all([
    prisma.paymentOutRecord.findMany({
      where: whereConditions,
      include: {
        payableRecord: {
          select: {
            id: true,
            payableNumber: true,
            payableAmount: true,
            remainingAmount: true,
          },
        },
        supplier: {
          select: { id: true, name: true, phone: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    }),
    prisma.paymentOutRecord.count({ where: whereConditions }),
  ]);

  // 计算统计数据
  const allPayments = await prisma.paymentOutRecord.findMany({
    where: whereConditions,
    select: {
      paymentAmount: true,
      status: true,
    },
  });

  const statistics = {
    totalAmount: allPayments.reduce(
      (sum, p) => sum + Number(p.paymentAmount),
      0
    ),
    confirmedAmount: allPayments
      .filter(p => p.status === 'confirmed')
      .reduce((sum, p) => sum + Number(p.paymentAmount), 0),
    pendingAmount: allPayments
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + Number(p.paymentAmount), 0),
    recordCount: allPayments.length,
  };

  return {
    payments,
    statistics,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 付款记录页面 - 服务器组件
 */
export default async function PaymentsOutPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    paymentMethod?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPaymentsOutData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search,
    status: params.status,
    paymentMethod: params.paymentMethod,
    sortBy: params.sortBy || 'createdAt',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <PaymentsOutPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}

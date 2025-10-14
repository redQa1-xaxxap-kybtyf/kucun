import type { Metadata } from 'next';

import { prisma } from '@/lib/db';
import type { PayableSourceType, PayableStatus } from '@/lib/types/payable';
import { PAYABLE_SORT_OPTIONS } from '@/lib/types/payable';

type PayableSortField =
  | 'createdAt'
  | 'payableAmount'
  | 'dueDate'
  | 'remainingAmount';

import { PayablesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应付款管理 - 财务管理',
  description: '管理供应商应付款和付款记录，跟踪付款状态和逾期情况',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 服务器端获取应付款数据
 */
async function getPayablesData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sourceType?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = searchParams.status;
  const sourceType = searchParams.sourceType;
  const sortFieldValues: PayableSortField[] = [
    'createdAt',
    'payableAmount',
    'dueDate',
    'remainingAmount',
  ];
  const sortBy: PayableSortField =
    searchParams.sortBy &&
    sortFieldValues.includes(searchParams.sortBy as PayableSortField)
      ? (searchParams.sortBy as PayableSortField)
      : 'createdAt';
  const sortOrder = searchParams.sortOrder || 'desc';

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (search) {
    whereConditions.OR = [
      { payableNumber: { contains: search } },
      { supplier: { name: { contains: search } } },
    ];
  }

  if (status) {
    whereConditions.status = status;
  }

  if (sourceType) {
    whereConditions.sourceType = sourceType;
  }

  // 查询应付款记录
  const [payables, total] = await Promise.all([
    prisma.payableRecord.findMany({
      where: whereConditions,
      include: {
        supplier: {
          select: { id: true, name: true, phone: true, address: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
        paymentOutRecords: {
          select: {
            id: true,
            paymentNumber: true,
            paymentAmount: true,
            paymentDate: true,
            status: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
      orderBy: {
        [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.payableRecord.count({ where: whereConditions }),
  ]);

  // 计算统计数据（使用相同的筛选条件）
  const allPayables = await prisma.payableRecord.findMany({
    where: whereConditions,
    select: {
      payableAmount: true,
      paidAmount: true,
      remainingAmount: true,
      status: true,
      dueDate: true,
    },
  });

  const totalPayables = allPayables.reduce(
    (sum, p) => sum + p.payableAmount,
    0
  );
  const totalPaidAmount = allPayables.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalRemainingAmount = allPayables.reduce(
    (sum, p) => sum + p.remainingAmount,
    0
  );

  const pendingCount = allPayables.filter(p => p.status === 'pending').length;
  const partialCount = allPayables.filter(p => p.status === 'partial').length;
  const overdueCount = allPayables.filter(p => p.status === 'overdue').length;
  const paidCount = allPayables.filter(p => p.status === 'paid').length;

  return {
    payables:
      payables as unknown as import('@/lib/types/payable').PayableRecordDetail[],
    statistics: {
      totalPayables,
      totalPaidAmount,
      totalRemainingAmount,
      pendingCount,
      partialCount,
      overdueCount,
      paidCount,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * 应付款管理页面 - 服务器组件
 * 使用服务器端数据获取，优化首屏加载和SEO
 */
export default async function PayablesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sourceType?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPayablesData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search || '',
    status: ((): PayableStatus | undefined => {
      const value = params.status;
      const statuses: PayableStatus[] = [
        'pending',
        'partial',
        'paid',
        'overdue',
        'cancelled',
      ];
      return value && statuses.includes(value as PayableStatus)
        ? (value as PayableStatus)
        : undefined;
    })(),
    sourceType: ((): PayableSourceType | undefined => {
      const value = params.sourceType;
      const sources: PayableSourceType[] = [
        'purchase_order',
        'factory_shipment',
        'sales_order',
        'service',
        'other',
      ];
      return value && sources.includes(value as PayableSourceType)
        ? (value as PayableSourceType)
        : undefined;
    })(),
    sortBy: ((): PayableSortField => {
      const value = params.sortBy;
      const sortValues = PAYABLE_SORT_OPTIONS.map(option => option.value);
      return value && sortValues.includes(value as PayableSortField)
        ? (value as PayableSortField)
        : 'createdAt';
    })(),
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <PayablesPageClient initialData={initialData} initialParams={queryParams} />
  );
}

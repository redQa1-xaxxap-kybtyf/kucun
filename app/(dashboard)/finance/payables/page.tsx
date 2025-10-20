import {
  HydrationBoundary,
  QueryClient,
  dehydrate,
} from '@tanstack/react-query';
import type { Metadata } from 'next';

import { payableQueryKeys } from '@/lib/api/payables';
import { prisma } from '@/lib/db';
import {
  PAYABLE_SORT_OPTIONS,
  type PayableSourceType,
  type PayableStatus,
} from '@/lib/types/payable';

type PayableSortField =
  | 'createdAt'
  | 'payableAmount'
  | 'dueDate'
  | 'remainingAmount';

import { PayablesPageClient } from './page-client';

export const metadata: Metadata = {
  title: '应付款管理 - 财务管理',
  description: '管理供应商应付款和付款记录，跟踪付款状态',
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
  startDate?: string;
  endDate?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const statusParam = searchParams.status;
  const allowedStatuses: PayableStatus[] = [
    'pending',
    'partial',
    'overdue',
    'paid',
    'cancelled',
  ];
  const status =
    statusParam && allowedStatuses.includes(statusParam as PayableStatus)
      ? (statusParam as PayableStatus)
      : undefined;
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
  const startDateParam = searchParams.startDate;
  const endDateParam = searchParams.endDate;

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

  if (startDateParam || endDateParam) {
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (startDateParam) {
      createdAtFilter.gte = new Date(startDateParam);
    }
    if (endDateParam) {
      const endDate = new Date(endDateParam);
      endDate.setHours(23, 59, 59, 999);
      createdAtFilter.lte = endDate;
    }
    whereConditions.createdAt = createdAtFilter;
  }

  // 查询应付款记录与统计数据
  const [payables, total, amountSummary, statusSummary] = await Promise.all([
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
    prisma.payableRecord.aggregate({
      where: whereConditions,
      _sum: {
        payableAmount: true,
        paidAmount: true,
        remainingAmount: true,
      },
    }),
    prisma.payableRecord.groupBy({
      where: whereConditions,
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const totals = {
    totalPayables: Number(amountSummary._sum.payableAmount ?? 0),
    totalPaidAmount: Number(amountSummary._sum.paidAmount ?? 0),
    totalRemainingAmount: Number(amountSummary._sum.remainingAmount ?? 0),
  };

  const statusCountMap = statusSummary.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.status] = item._count._all;
      return acc;
    },
    {}
  );

  return {
    payables:
      payables as unknown as import('@/lib/types/payable').PayableRecordDetail[],
    statistics: {
      totalPayables: totals.totalPayables,
      totalPaidAmount: totals.totalPaidAmount,
      totalRemainingAmount: totals.totalRemainingAmount,
      pendingCount: statusCountMap.pending ?? 0,
      partialCount: statusCountMap.partial ?? 0,
      overdueCount: statusCountMap.overdue ?? 0,
      paidCount: statusCountMap.paid ?? 0,
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
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getPayablesData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search:
      typeof params.search === 'string' && params.search.trim().length > 0
        ? params.search.trim()
        : undefined,
    status: ((): PayableStatus | undefined => {
      const value = params.status;
      const statuses: PayableStatus[] = [
        'pending',
        'partial',
        'paid',
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
    startDate:
      typeof params.startDate === 'string' && params.startDate.trim().length > 0
        ? params.startDate
        : undefined,
    endDate:
      typeof params.endDate === 'string' && params.endDate.trim().length > 0
        ? params.endDate
        : undefined,
  };

  const queryClient = new QueryClient({
    defaultOptions: {
      dehydrate: {
        shouldDehydrateQuery: () => true,
      },
    },
  });

  queryClient.setQueryData(payableQueryKeys.list(queryParams), {
    data: initialData.payables,
    pagination: initialData.pagination,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PayablesPageClient
        initialParams={queryParams}
        initialStatistics={initialData.statistics}
      />
    </HydrationBoundary>
  );
}

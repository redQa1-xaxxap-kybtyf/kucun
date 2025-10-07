import type { Metadata } from 'next';

import { prisma } from '@/lib/db';

import { StatementsPageClient } from './page-client';

export const metadata: Metadata = {
  title: '往来账单 - 财务管理',
  description: '管理客户和供应商的综合账务往来',
};

// ✅ Next.js 15 Route Segment Config
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * 服务器端获取往来账单数据
 */
async function getStatementsData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(searchParams.limit || '20', 10);
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const type = searchParams.type || 'customer';
  const sortBy = searchParams.sortBy || 'totalAmount';
  const sortOrder = searchParams.sortOrder || 'desc';

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {
    entityType: type,
  };

  if (search) {
    whereConditions.entityName = { contains: search };
  }

  // 查询往来账单
  const [statements, total] = await Promise.all([
    prisma.accountStatement.findMany({
      where: whereConditions,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    }),
    prisma.accountStatement.count({ where: whereConditions }),
  ]);

  // 计算统计数据
  const allStatements = await prisma.accountStatement.findMany({
    where: whereConditions,
    select: {
      totalAmount: true,
      paidAmount: true,
      pendingAmount: true,
      overdueAmount: true,
    },
  });

  const statistics = {
    totalReceivable: allStatements
      .filter((_, i) => type === 'customer')
      .reduce((sum, s) => sum + Number(s.pendingAmount), 0),
    totalPayable: allStatements
      .filter((_, i) => type === 'supplier')
      .reduce((sum, s) => sum + Number(s.pendingAmount), 0),
    totalCustomers: type === 'customer' ? total : 0,
    totalSuppliers: type === 'supplier' ? total : 0,
  };

  return {
    statements,
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
 * 往来账单页面 - 服务器组件
 */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    search?: string;
    type?: string;
    sortBy?: string;
    sortOrder?: string;
  }>;
}) {
  const params = await searchParams;
  const initialData = await getStatementsData(params);

  const queryParams = {
    page: parseInt(params.page || '1', 10),
    limit: parseInt(params.limit || '20', 10),
    search: params.search,
    type: params.type || 'customer',
    sortBy: params.sortBy || 'totalAmount',
    sortOrder: (params.sortOrder as 'asc' | 'desc') || 'desc',
  };

  return (
    <StatementsPageClient
      initialData={initialData}
      initialParams={queryParams}
    />
  );
}

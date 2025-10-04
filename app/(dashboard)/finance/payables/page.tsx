import { Download, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PayablesClient } from '@/components/finance/payables-client';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: '应付款管理 - 财务管理',
  description: '管理供应商应付款和付款记录，跟踪付款状态和逾期情况',
};

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
  const sortBy = searchParams.sortBy || 'createdAt';
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

  const now = new Date();
  const overduePayables = allPayables.filter(
    p => p.dueDate && p.dueDate < now && p.remainingAmount > 0
  );
  const overdueAmount = overduePayables.reduce(
    (sum, p) => sum + p.remainingAmount,
    0
  );

  const pendingCount = allPayables.filter(p => p.status === 'pending').length;
  const paidCount = allPayables.filter(p => p.status === 'paid').length;
  const overdueCount = overduePayables.length;

  return {
    payables:
      payables as unknown as import('@/lib/types/payable').PayableRecordDetail[],
    statistics: {
      totalPayables,
      totalPaidAmount,
      totalRemainingAmount,
      overdueAmount,
      pendingCount,
      paidCount,
      overdueCount,
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
  searchParams: {
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sourceType?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const initialData = await getPayablesData(searchParams);

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">应付款管理</h1>
          <p className="text-muted-foreground">管理供应商应付款和付款记录</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/payables/export">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Link>
          </Button>
          <Button asChild>
            <Link href="/finance/payables/create">
              <Plus className="mr-2 h-4 w-4" />
              新建应付款
            </Link>
          </Button>
        </div>
      </div>

      {/* 客户端交互组件 */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">加载中...</div>
          </div>
        }
      >
        <PayablesClient initialData={initialData} />
      </Suspense>
    </div>
  );
}

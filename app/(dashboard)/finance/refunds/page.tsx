import { Download, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { RefundsClient } from '@/components/finance/refunds-client';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { paginationConfig } from '@/lib/env';
import type {
  RefundMethod,
  RefundStatus,
  RefundType,
} from '@/lib/types/refund';

export const metadata: Metadata = {
  title: '应退货款管理 - 财务管理',
  description: '管理退货订单产生的应退账款，跟踪退款处理状态',
};

/**
 * 服务器组件传递给客户端的退款记录类型
 * Date 被序列化为 string
 */
type SerializedRefundRecord = {
  id: string;
  refundNumber: string;
  returnOrderId: string | null;
  salesOrderId: string;
  customerId: string;
  userId: string;
  refundType: RefundType;
  refundMethod: RefundMethod;
  refundAmount: number;
  processedAmount: number;
  remainingAmount: number;
  refundDate: Date;
  processedDate: Date | null;
  status: RefundStatus;
  reason: string;
  remarks: string | null;
  bankInfo: string | null;
  receiptNumber: string | null;
  returnOrderNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 服务器端获取退款数据
 */
async function getRefundsData(searchParams: {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const page = parseInt(searchParams.page || '1', 10);
  const limit = parseInt(
    searchParams.limit || `${paginationConfig.defaultPageSize}`,
    10
  );
  const skip = (page - 1) * limit;
  const search = searchParams.search || '';
  const status = searchParams.status;
  const sortBy = searchParams.sortBy || 'refundDate';
  const sortOrder = searchParams.sortOrder || 'desc';

  // 构建查询条件
  const whereConditions: Record<string, unknown> = {};

  if (search) {
    whereConditions.OR = [
      { refundNumber: { contains: search } },
      { returnOrderNumber: { contains: search } },
    ];
  }

  if (status) {
    whereConditions.status = status;
  }

  // 查询退款记录
  const [refundsData, total] = await Promise.all([
    prisma.refundRecord.findMany({
      where: whereConditions,
      orderBy: {
        [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc',
      },
      skip,
      take: limit,
      select: {
        id: true,
        refundNumber: true,
        returnOrderId: true,
        salesOrderId: true,
        customerId: true,
        userId: true,
        refundType: true,
        refundMethod: true,
        refundAmount: true,
        processedAmount: true,
        remainingAmount: true,
        refundDate: true,
        processedDate: true,
        status: true,
        reason: true,
        remarks: true,
        bankInfo: true,
        receiptNumber: true,
        returnOrderNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.refundRecord.count({ where: whereConditions }),
  ]);

  // 计算统计数据（使用相同的筛选条件）
  const allRefunds = await prisma.refundRecord.findMany({
    where: whereConditions,
    select: {
      refundAmount: true,
      processedAmount: true,
      remainingAmount: true,
      status: true,
    },
  });

  const totalRefundable = allRefunds.reduce(
    (sum, r) => sum + r.refundAmount,
    0
  );
  const totalProcessed = allRefunds.reduce(
    (sum, r) => sum + r.processedAmount,
    0
  );
  const totalRemaining = allRefunds.reduce(
    (sum, r) => sum + r.remainingAmount,
    0
  );

  const pendingCount = allRefunds.filter(r => r.status === 'pending').length;
  const processingCount = allRefunds.filter(
    r => r.status === 'processing'
  ).length;
  const completedCount = allRefunds.filter(
    r => r.status === 'completed'
  ).length;

  // 将 refundType 转换为 RefundType 类型
  const refunds: SerializedRefundRecord[] = refundsData.map(refund => ({
    ...refund,
    refundType: refund.refundType as RefundType,
    refundMethod: refund.refundMethod as RefundMethod,
    status: refund.status as RefundStatus,
  }));

  return {
    refunds,
    statistics: {
      totalRefundable,
      totalProcessed,
      totalRemaining,
      pendingCount,
      processingCount,
      completedCount,
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
 * 应退货款管理页面 - 服务器组件
 * 使用服务器端数据获取，优化首屏加载和SEO
 */
export default async function RefundsPage({
  searchParams,
}: {
  searchParams: {
    page?: string;
    limit?: string;
    search?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const initialData = await getRefundsData(searchParams);

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">应退货款</h1>
          <p className="text-muted-foreground">管理退货订单产生的应退账款</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/refunds/export">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Link>
          </Button>
          <Button asChild>
            <Link href="/return-orders/create">
              <Plus className="mr-2 h-4 w-4" />
              新建退货订单
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
        <RefundsClient initialData={initialData} />
      </Suspense>
    </div>
  );
}

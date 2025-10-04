import { Download, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import { getReceivables } from '@/lib/services/receivables-service';
import { paginationConfig } from '@/lib/env';
import type { PaymentStatus } from '@/lib/services/receivables-service';

export const metadata: Metadata = {
  title: '应收货款管理 - 财务管理',
  description: '管理销售订单产生的应收账款，跟踪收款状态和逾期情况',
};

/**
 * 应收货款管理页面 - 服务器组件
 * 使用服务器端数据获取，优化首屏加载和SEO
 *
 * 注意：应收账款的 paymentStatus 是计算字段（基于 paidAmount vs totalAmount）
 * 因此状态过滤必须在应用层完成，这是业务逻辑的限制
 * 服务层 (receivables-service.ts) 已正确实现：
 * 1. 先查询所有符合基础条件的数据
 * 2. 计算 paymentStatus
 * 3. 根据状态过滤
 * 4. 分页
 * 5. 统计数据基于过滤后的完整数据集，确保准确性
 */
export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const page = parseInt((params.page as string) || '1', 10);
  const limit = parseInt(
    (params.limit as string) || `${paginationConfig.defaultPageSize}`,
    10
  );
  const search = (params.search as string) || '';
  const status = (params.status as PaymentStatus) || undefined;
  const sortBy = (params.sortBy as string) || 'orderDate';
  const sortOrder = (params.sortOrder as 'asc' | 'desc') || 'desc';

  // 服务器端获取初始数据
  const initialData = await getReceivables({
    page,
    pageSize: limit,
    search,
    paymentStatus: status,
    sortBy,
    sortOrder,
  });

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">应收货款</h1>
          <p className="text-muted-foreground">管理销售订单产生的应收账款</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/finance/receivables/export">
              <Download className="mr-2 h-4 w-4" />
              导出
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sales-orders/create">
              <Plus className="mr-2 h-4 w-4" />
              新建销售订单
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
        <ReceivablesClient initialData={initialData} />
      </Suspense>
    </div>
  );
}

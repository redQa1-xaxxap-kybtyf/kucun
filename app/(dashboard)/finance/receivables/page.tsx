import { Download, Plus, TrendingUp } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { ReceivablesClient } from '@/components/finance/receivables-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { paginationConfig } from '@/lib/env';
import type { PaymentStatus } from '@/lib/services/receivables-service';
import { getReceivables } from '@/lib/services/receivables-service';

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
    limit,
    search,
    paymentStatus: status,
    sortBy,
    sortOrder,
  });

  return (
    <div className="mx-auto max-w-none px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-4">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    应收货款管理
                  </h1>
                  <p className="text-sm text-gray-600">
                    管理销售订单产生的应收账款，跟踪收款状态和逾期情况
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Link href="/finance/receivables/export">
                    <Download className="mr-2 h-4 w-4" />
                    导出
                  </Link>
                </Button>
                <Button
                  size="lg"
                  asChild
                  className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
                >
                  <Link href="/sales-orders/create">
                    <Plus className="mr-2 h-4 w-4" />
                    新建销售订单
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
    </div>
  );
}

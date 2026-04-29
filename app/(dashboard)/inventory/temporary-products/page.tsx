/**
 * 外采产品库 - 只读查询页面
 *
 * 功能:
 * - 查看调货销售中使用的外采产品
 * - 按供应商筛选
 * - 搜索产品(编码/名称/规格)
 * - 按使用次数/最后使用时间排序
 * - 查看使用统计
 *
 * 注意: 此页面仅用于查询,不提供手动创建/编辑/删除功能
 *       外采产品由系统在创建调货销售订单时自动管理
 */

import { FileText } from 'lucide-react';
import { Suspense } from 'react';

import { PageHeader } from '@/components/common/page-header';

import { TemporaryProductsClient } from './page-client';

export const metadata = {
  title: '外采产品库',
  description: '查看调货销售中自动记录的外采产品和最近价格',
};

export default function TemporaryProductsPage() {
  return (
    // 与库存总览、库存调整等页面保持一致的布局容器
    <div className="flex h-full flex-col overflow-auto p-4 sm:p-6">
      <div className="space-y-6">
        <PageHeader
          title="外采产品库"
          description="集中查看供应商产品、最近成本价和使用情况，客户小程序只展示产品信息不展示价格"
          icon={<FileText className="h-5 w-5" />}
        />

        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground text-sm">加载中...</div>
            </div>
          }
        >
          <TemporaryProductsClient />
        </Suspense>
      </div>
    </div>
  );
}

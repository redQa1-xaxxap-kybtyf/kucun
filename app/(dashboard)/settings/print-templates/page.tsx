/**
 * 打印模板列表页
 */

import { Suspense } from 'react';

import { TemplateList } from './template-list';

export default function PrintTemplatesPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">打印模板管理</h1>
        <p className="text-muted-foreground">
          创建和管理销售订单、采购订单、厂家发货、入库记录、退货订单等打印模板
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <p className="text-muted-foreground">加载中...</p>
          </div>
        }
      >
        <TemplateList />
      </Suspense>
    </div>
  );
}

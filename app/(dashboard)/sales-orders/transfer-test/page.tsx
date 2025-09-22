'use client';

import { ERPSalesOrderForm } from '@/components/sales-orders/erp-sales-order-form';

/**
 * 调货销售功能测试页面
 */
export default function TransferSalesTestPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">调货销售功能测试</h1>
        <p className="text-muted-foreground">
          测试新增的订单类型选择和调货销售特殊字段功能
        </p>
      </div>

      <div className="max-w-4xl">
        <ERPSalesOrderForm
          onSuccess={() => {
            // 订单创建成功处理
          }}
          onCancel={() => {
            // 取消创建订单处理
          }}
        />
      </div>
    </div>
  );
}

'use client';

import { ERPReturnOrderList } from '@/components/return-orders/erp-return-order-list';
import type { ReturnOrder } from '@/lib/types/return-order';

/**
 * 退货订单页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function ReturnOrdersPage() {
  // 操作处理函数
  const handleViewDetail = (returnOrder: ReturnOrder) => {
    // 可以在这里添加详情对话框逻辑
    console.log('查看退货订单详情:', returnOrder);
  };

  const handleEdit = (returnOrder: ReturnOrder) => {
    // 可以在这里添加编辑对话框逻辑
    console.log('编辑退货订单:', returnOrder);
  };

  const handleDelete = (returnOrder: ReturnOrder) => {
    // 可以在这里添加删除确认对话框逻辑
    console.log('删除退货订单:', returnOrder);
  };

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPReturnOrderList
        onViewDetail={handleViewDetail}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

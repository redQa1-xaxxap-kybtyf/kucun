'use client';

import { ERPReturnOrderList } from '@/components/return-orders/erp-return-order-list';
import type { ReturnOrder } from '@/lib/types/return-order';

/**
 * 退货订单页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function ReturnOrdersPageClient() {
  // 操作处理函数
  const handleViewDetail = (_returnOrder: ReturnOrder) => {
    // 可以在这里添加详情对话框逻辑
    // TODO: 实现详情对话框
  };

  const handleEdit = (_returnOrder: ReturnOrder) => {
    // 可以在这里添加编辑对话框逻辑
    // TODO: 实现编辑对话框
  };

  const handleDelete = (_returnOrder: ReturnOrder) => {
    // 可以在这里添加删除确认对话框逻辑
    // TODO: 实现删除确认对话框
  };

  return (
    <ERPReturnOrderList
      onViewDetail={handleViewDetail}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
}

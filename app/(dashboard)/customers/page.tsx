'use client';

import * as React from 'react';

import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { CustomerDetailDialog } from '@/components/customers/customer-detail-dialog';
import { ERPCustomerList } from '@/components/customers/erp-customer-list';
import type { Customer } from '@/lib/types/customer';

/**
 * 客户管理页面
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export default function CustomersPage() {
  // 对话框状态管理
  const [detailDialogOpen, setDetailDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<
    string | null
  >(null);
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);

  // 操作处理函数
  const handleViewDetail = (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setDetailDialogOpen(true);
  };

  const handleDelete = (customer: Customer) => {
    setSelectedCustomer(customer);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ERPCustomerList
        onViewDetail={handleViewDetail}
        onDelete={handleDelete}
      />

      {/* 对话框组件 */}
      <CustomerDetailDialog
        customerId={selectedCustomerId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      <CustomerDeleteDialog
        customer={selectedCustomer}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </div>
  );
}

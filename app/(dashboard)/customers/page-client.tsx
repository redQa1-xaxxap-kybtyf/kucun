'use client';

import * as React from 'react';

import { CustomerDeleteDialog } from '@/components/customers/customer-delete-dialog';
import { CustomerDetailDialog } from '@/components/customers/customer-detail-dialog';
import { ERPCustomerList } from '@/components/customers/erp-customer-list';
import type { Customer, CustomerQueryParams } from '@/lib/types/customer';

interface CustomersPageClientProps {
  initialData: {
    data: Customer[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  initialParams: CustomerQueryParams;
}

/**
 * 客户管理页面客户端组件
 * 负责用户交互和状态管理
 * 严格遵循前端架构规范：Client Component 层
 */
export function CustomersPageClient({
  initialData,
  initialParams,
}: CustomersPageClientProps) {
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
    <>
      <ERPCustomerList
        initialData={initialData}
        initialParams={initialParams}
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
    </>
  );
}

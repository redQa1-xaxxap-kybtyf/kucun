'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Customer } from '@/lib/types/customer';

import { ERPCustomerForm } from './erp-customer-form';

interface ERPCustomerEditDialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * ERP风格的客户编辑对话框组件
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export function ERPCustomerEditDialog({
  customerId,
  open,
  onOpenChange,
  onSuccess,
}: ERPCustomerEditDialogProps) {
  const [customer, setCustomer] = React.useState<Customer | null>(null);

  // 当对话框打开时获取客户数据
  React.useEffect(() => {
    if (open && customerId) {
      // 这里应该从API获取客户数据，但为了简化，我们先使用空数据
      // 实际应用中应该使用 useQuery 获取数据
      setCustomer(null);
    }
  }, [open, customerId]);

  const handleSuccess = () => {
    onOpenChange(false);
    if (onSuccess) {
      onSuccess();
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>编辑客户</DialogTitle>
        </DialogHeader>

        {customerId && customer && (
          <ERPCustomerForm
            mode="edit"
            initialData={customer}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        )}

        {customerId && !customer && (
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">编辑客户</h3>
              </div>
            </div>
            <div className="px-3 py-8">
              <div className="text-center text-xs text-muted-foreground">
                加载客户信息中...
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Customer } from '@/lib/types/customer';

import { ERPCustomerDetail } from './erp-customer-detail';

interface CustomerDetailDialogProps {
  customerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (customer: Customer) => void;
}

/**
 * 客户详情对话框组件
 * 使用ERP风格的紧凑布局，符合中国用户习惯
 */
export function CustomerDetailDialog({
  customerId,
  open,
  onOpenChange,
  onEdit,
}: CustomerDetailDialogProps) {
  const handleBack = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>客户详情</DialogTitle>
        </DialogHeader>

        {customerId && (
          <ERPCustomerDetail
            customerId={customerId}
            onEdit={onEdit}
            onBack={handleBack}
            showActions={true}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

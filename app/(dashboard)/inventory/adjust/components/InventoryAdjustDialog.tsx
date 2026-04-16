'use client';

import dynamic from 'next/dynamic';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { InventoryAdjustFormData } from '@/lib/validations/inventory-operations';

const InventoryOperationForm = dynamic(
  () =>
    import('@/components/inventory/inventory-operation-form').then(
      mod => mod.InventoryOperationForm
    ),
  { ssr: false, loading: () => null }
);

interface InventoryAdjustDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  initialValues?: Partial<InventoryAdjustFormData>;
}

export function InventoryAdjustDialog({
  onClose,
  onSuccess,
  initialValues,
}: InventoryAdjustDialogProps) {
  return (
    <Dialog open onOpenChange={open => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>库存调整</DialogTitle>
          <DialogDescription className="sr-only">
            调整库存数量并记录调整原因，保存后会同步更新当前库存数据。
          </DialogDescription>
        </DialogHeader>
        <InventoryOperationForm
          mode="adjust"
          initialValues={initialValues}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

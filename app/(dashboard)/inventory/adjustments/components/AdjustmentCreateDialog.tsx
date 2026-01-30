'use client';

import dynamic from 'next/dynamic';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const InventoryOperationForm = dynamic(
  () =>
    import('@/components/inventory/inventory-operation-form').then(
      mod => mod.InventoryOperationForm
    ),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex items-center justify-center py-10 text-sm">
        加载中...
      </div>
    ),
  }
);

interface AdjustmentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdjustmentCreateDialog({
  open,
  onOpenChange,
  onSuccess,
  onCancel,
}: AdjustmentCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>库存调整</DialogTitle>
        </DialogHeader>
        {open && (
          <InventoryOperationForm
            mode="adjust"
            onSuccess={onSuccess}
            onCancel={onCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}


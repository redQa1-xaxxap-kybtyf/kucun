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
  { ssr: false, loading: () => null }
);

interface InventoryAdjustDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function InventoryAdjustDialog({
  onClose,
  onSuccess,
}: InventoryAdjustDialogProps) {
  return (
    <Dialog open onOpenChange={open => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>库存调整</DialogTitle>
        </DialogHeader>
        <InventoryOperationForm mode="adjust" onSuccess={onSuccess} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}


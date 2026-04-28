'use client';

import { Package } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { TemporaryProductForm } from './components/TemporaryProductForm';
import { useTemporaryProductDialog } from './hooks/useTemporaryProductDialog';
import type { AddTemporaryProductDialogProps } from './types';

export function AddTemporaryProductDialog(
  props: AddTemporaryProductDialogProps
) {
  const { form, handleSubmit, handleClose } = useTemporaryProductDialog(props);
  const { open, onOpenChange, requirements } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (nextOpen) {
          onOpenChange(true);
        } else {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> 添加临时产品
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <TemporaryProductForm
            form={form}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            requirements={requirements}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

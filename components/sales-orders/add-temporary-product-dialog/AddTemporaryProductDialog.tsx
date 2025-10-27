'use client';

import { Package } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const { open, onOpenChange, initialName, requirements } = props;

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
            <Package className="h-5 w-5" /> 添加临时商品
          </DialogTitle>
          <DialogDescription>
            临时商品用于记录库存外的特殊订单项，将不会同步到库存系统。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            支持快速录入商品规格、单位及每件片数信息
          </Badge>
          <TemporaryProductForm
            form={form}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            requirements={requirements}
          />
        </div>

        <DialogFooter className="text-muted-foreground pt-0 text-xs">
          初始关键词：{initialName || '（未提供）'}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import * as React from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { RefundProcessForm } from './refund-process-form';

interface RefundProcessDialogProps {
  refundId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * 退款处理弹窗
 * 包裹可复用的退款处理表单
 */
export function RefundProcessDialog({
  refundId,
  open,
  onOpenChange,
  onSuccess,
}: RefundProcessDialogProps) {
  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto [&>button]:hidden"
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>办理退款</DialogTitle>
        </DialogHeader>
        <RefundProcessForm
          refundId={refundId}
          variant="dialog"
          onCancel={handleClose}
          onSuccess={onSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

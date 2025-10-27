'use client';

import * as React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { FactoryShipmentOrder } from '@/lib/types/factory-shipment';

type OrderActionType = 'cancel' | 'delete';

interface ActionDialogState {
  type: OrderActionType;
  order: FactoryShipmentOrder;
}

interface OrderActionDialogProps {
  action: ActionDialogState | null;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function OrderActionDialog({
  action,
  onClose,
  onConfirm,
  isPending,
}: OrderActionDialogProps) {
  const open = Boolean(action);
  const orderNumber = action?.order.orderNumber ?? '';
  const isDelete = action?.type === 'delete';

  return (
    <AlertDialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDelete ? '确认删除订单' : '确认取消订单'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDelete
              ? `删除后，订单 ${orderNumber} 将无法恢复。`
              : `取消后，订单 ${orderNumber} 的状态将更新为已取消。`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>返回</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? '处理中...' : isDelete ? '删除订单' : '取消订单'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export type { ActionDialogState, OrderActionType };

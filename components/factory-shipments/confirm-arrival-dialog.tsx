'use client';

import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useUpdateFactoryShipmentOrderStatus } from '@/lib/api/factory-shipments';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

interface ConfirmArrivalDialogProps {
  orderId: string;
  orderNumber: string;
  containerNumber?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConfirmArrivalDialog({
  orderId,
  orderNumber,
  containerNumber,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmArrivalDialogProps) {
  const { toast } = useToast();
  const updateStatusMutation = useUpdateFactoryShipmentOrderStatus();

  const [arrivalDate, setArrivalDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  useEffect(() => {
    if (open) {
      setArrivalDate(new Date().toISOString().slice(0, 10));
      setRemarks('');
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!containerNumber) {
      toast({
        title: '无法确认到港',
        description: '请先填写集装箱号码后再确认到港。',
        variant: 'destructive',
      });
      return;
    }

    const arrivalDateIso = arrivalDate
      ? new Date(`${arrivalDate}T00:00:00`).toISOString()
      : new Date().toISOString();

    try {
      await updateStatusMutation.mutateAsync({
        id: orderId,
        data: {
          idempotencyKey: crypto.randomUUID(),
          status: FACTORY_SHIPMENT_STATUS.ARRIVED,
          containerNumber,
          arrivalDate: new Date(arrivalDateIso),
          remarks: remarks.trim() || undefined,
        },
      });

      toast({
        title: '到港已确认',
        description: `订单 ${orderNumber} 已标记为到港状态。`,
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: '确认到港失败',
        description:
          error instanceof Error
            ? error.message
            : '更新订单状态时发生错误，请稍后再试。',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>确认到港</DialogTitle>
          <DialogDescription>
            请确认集装箱 {containerNumber || '（未填写）'}{' '}
            已到港，并记录到港日期。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                到港日期
              </label>
              <Input
                type="date"
                value={arrivalDate}
                onChange={event => setArrivalDate(event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                备注（可选）
              </label>
              <Textarea
                value={remarks}
                onChange={event => setRemarks(event.target.value)}
                placeholder="例如：船务确认，待安排入库。"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateStatusMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={updateStatusMutation.isPending}>
              {updateStatusMutation.isPending ? '提交中...' : '确认到港'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

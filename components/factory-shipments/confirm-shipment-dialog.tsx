'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ship } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

// 确认发货表单验证规则
const confirmShipmentSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '集装箱号码不能为空')
    .max(50, '集装箱号码不能超过50个字符'),
});

type ConfirmShipmentData = z.infer<typeof confirmShipmentSchema>;

interface ConfirmShipmentDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * 确认发货 API 调用
 * 调用 PATCH /api/factory-shipments/[id]/status
 */
const confirmShipment = async (
  orderId: string,
  data: ConfirmShipmentData
): Promise<void> => {
  const response = await fetch(`/api/factory-shipments/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      status: FACTORY_SHIPMENT_STATUS.FACTORY_SHIPPED,
      containerNumber: data.containerNumber,
      shipmentDate: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '确认发货失败');
  }
};

/**
 * 确认发货对话框组件
 * 用于在订单详情页面确认发货，要求填写集装箱号码
 */
export function ConfirmShipmentDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmShipmentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ConfirmShipmentData>({
    resolver: zodResolver(confirmShipmentSchema),
    defaultValues: {
      containerNumber: '',
    },
  });

  // 确认发货 mutation
  const confirmMutation = useMutation({
    mutationFn: (data: ConfirmShipmentData) => confirmShipment(orderId, data),
    onSuccess: () => {
      toast({
        title: '确认发货成功',
        description: `订单 ${orderNumber} 已确认发货`,
      });
      // 刷新订单详情和列表
      queryClient.invalidateQueries({
        queryKey: ['factory-shipment-order', orderId],
      });
      queryClient.invalidateQueries({
        queryKey: ['factory-shipment-orders'],
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: error => {
      toast({
        title: '确认发货失败',
        description:
          error instanceof Error ? error.message : '操作失败，请重试',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ConfirmShipmentData) => {
    confirmMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            确认发货
          </DialogTitle>
          <DialogDescription>
            请填写集装箱号码以确认订单 {orderNumber} 已发货
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="containerNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    集装箱号码 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="请输入集装箱号码"
                      {...field}
                      disabled={confirmMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={confirmMutation.isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={confirmMutation.isPending}>
                {confirmMutation.isPending ? '确认中...' : '确认发货'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

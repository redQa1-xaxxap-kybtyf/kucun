'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { Ship } from 'lucide-react';
import * as React from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { DateTimePicker } from '@/components/ui/date-time-picker';
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useUpdateFactoryShipmentOrderStatus } from '@/lib/api/factory-shipments';
import { queryKeys } from '@/lib/queryKeys';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

// ✅ 确认发货表单验证规则 - 移除.default(),在defaultValues中设置
const confirmShipmentSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '确认发货时必须填写集装箱号码')
    .max(50, '集装箱号码不能超过50个字符'),
  shippingCompany: z
    .string()
    .max(100, '船运公司名称不能超过100个字符')
    .optional()
    .or(z.literal('')),
  estimatedArrival: z.date().optional(),
  shipmentDate: z.date(), // ✅ 移除.default(() => new Date()),在defaultValues中设置
});

type ConfirmShipmentData = z.infer<typeof confirmShipmentSchema>;
type ConfirmShipmentForm = UseFormReturn<ConfirmShipmentData>;

interface ConfirmShipmentDialogProps {
  orderId: string;
  orderNumber: string;
  containerNumber?: string | null;
  shippingCompany?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type ConfirmShipmentDialogStateProps = Pick<
  ConfirmShipmentDialogProps,
  | 'orderId'
  | 'orderNumber'
  | 'containerNumber'
  | 'shippingCompany'
  | 'open'
  | 'onOpenChange'
  | 'onSuccess'
>;

function useConfirmShipmentDialogState({
  orderId,
  orderNumber,
  containerNumber,
  shippingCompany,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmShipmentDialogStateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<ConfirmShipmentData>({
    resolver: standardSchemaResolver(confirmShipmentSchema),
    defaultValues: {
      containerNumber: containerNumber || '',
      shippingCompany: shippingCompany || '',
      estimatedArrival: undefined,
      shipmentDate: new Date(),
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        containerNumber: containerNumber || '',
        shippingCompany: shippingCompany || '',
        estimatedArrival: undefined,
        shipmentDate: new Date(),
      });
    }
  }, [containerNumber, shippingCompany, open, form]);

  const confirmMutation = useUpdateFactoryShipmentOrderStatus();

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = () => {
    toast({
      title: '确认发货成功',
      description: `订单 ${orderNumber} 已确认发货`,
      variant: 'success',
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.factoryShipments.detail(orderId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.factoryShipments.lists(),
    });
    form.reset();
    handleClose();
    onSuccess?.();
  };

  const handleError = (error: unknown) => {
    toast({
      title: '确认发货失败',
      description: error instanceof Error ? error.message : '操作失败，请重试',
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit(data => {
    const estimatedArrivalIso = data.estimatedArrival
      ? data.estimatedArrival.toISOString()
      : undefined;
    const shipmentDateIso = data.shipmentDate
      ? data.shipmentDate.toISOString()
      : new Date().toISOString();

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      status: FACTORY_SHIPMENT_STATUS.SHIPPED,
      containerNumber: data.containerNumber,
      shippingCompany: data.shippingCompany,
      estimatedArrival: estimatedArrivalIso,
      shipmentDate: shipmentDateIso,
    };

    confirmMutation.mutate(
      {
        id: orderId,
        data: payload,
      },
      {
        onSuccess: handleSuccess,
        onError: handleError,
      }
    );
  });

  return {
    confirmMutation,
    form,
    handleCancel: handleClose,
    handleSubmit,
  };
}

function ContainerNumberField({
  form,
  disabled,
}: {
  form: ConfirmShipmentForm; // ✅ 适配standardSchemaResolver
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="containerNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            集装箱号码 <span className="text-[hsl(var(--color-error))]">*</span>
          </FormLabel>
          <FormControl>
            <Input
              placeholder="请输入集装箱号码"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>
            确认发货时必须填写货运公司提供的集装箱号
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ShippingCompanyField({
  form,
  disabled,
}: {
  form: ConfirmShipmentForm; // ✅ 适配standardSchemaResolver
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shippingCompany"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            船运公司 <span className="text-yellow-600">(推荐填写)</span>
          </FormLabel>
          <FormControl>
            <Input
              placeholder="如已知,请填写船运公司"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>
            填写船运公司信息可以更好地追踪货物状态,可稍后补充
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function EstimatedArrivalField({
  form,
  disabled,
}: {
  form: ConfirmShipmentForm; // ✅ 适配standardSchemaResolver
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="estimatedArrival"
      render={({ field }) => (
        <FormItem>
          <FormLabel>预计到达时间</FormLabel>
          <FormControl>
            <DateTimePicker
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>可选,如有预计时间请填写</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ShipmentDateField({
  form,
  disabled,
}: {
  form: ConfirmShipmentForm; // ✅ 适配standardSchemaResolver
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shipmentDate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>发货时间</FormLabel>
          <FormControl>
            <DateTimePicker
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ConfirmShipmentDialogView({
  open,
  onOpenChange,
  orderNumber,
  form,
  isPending,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  form: ConfirmShipmentForm; // ✅ 适配standardSchemaResolver
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" /> 确认发货
          </DialogTitle>
          <DialogDescription>
            请填写集装箱号码完成确认。如已知船运公司，可一并填写，方便后续追踪（订单{' '}
            {orderNumber}）。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ContainerNumberField form={form} disabled={isPending} />
            <ShippingCompanyField form={form} disabled={isPending} />
            <EstimatedArrivalField form={form} disabled={isPending} />
            <ShipmentDateField form={form} disabled={isPending} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '确认中...' : '确认发货'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 确认发货对话框组件
 * 用于在订单详情页面确认发货，要求填写集装箱号码
 */
export function ConfirmShipmentDialog({
  orderId,
  orderNumber,
  containerNumber,
  shippingCompany,
  open,
  onOpenChange,
  onSuccess,
}: ConfirmShipmentDialogProps) {
  const { confirmMutation, form, handleCancel, handleSubmit } =
    useConfirmShipmentDialogState({
      orderId,
      orderNumber,
      containerNumber,
      shippingCompany,
      open,
      onOpenChange,
      onSuccess,
    });

  return (
    <ConfirmShipmentDialogView
      open={open}
      onOpenChange={onOpenChange}
      orderNumber={orderNumber}
      form={form}
      isPending={confirmMutation.isPending}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
  );
}

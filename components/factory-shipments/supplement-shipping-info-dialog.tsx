'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Ship } from 'lucide-react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  factoryShipmentQueryKeys,
  useUpdateFactoryShipmentOrderStatus,
} from '@/lib/api/factory-shipments';
import { FACTORY_SHIPMENT_STATUS } from '@/lib/types/factory-shipment';

// 补充船公司信息表单验证规则
const supplementShippingInfoSchema = z.object({
  shippingCompany: z
    .string()
    .min(1, '船公司名称不能为空')
    .max(100, '船公司名称不能超过100个字符'),
  estimatedArrival: z.date().optional(),
  autoStartTracking: z.boolean().default(true),
});

type SupplementShippingInfoData = z.infer<typeof supplementShippingInfoSchema>;

interface SupplementShippingInfoDialogProps {
  orderId: string;
  orderNumber: string;
  containerNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type SupplementShippingInfoDialogStateProps = Pick<
  SupplementShippingInfoDialogProps,
  'orderId' | 'orderNumber' | 'containerNumber' | 'onOpenChange' | 'onSuccess'
>;

function useSupplementShippingInfoDialogState({
  orderId,
  orderNumber,
  containerNumber,
  onOpenChange,
  onSuccess,
}: SupplementShippingInfoDialogStateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<SupplementShippingInfoData>({
    resolver: standardSchemaResolver(supplementShippingInfoSchema),
    defaultValues: {
      shippingCompany: '',
      estimatedArrival: undefined,
      autoStartTracking: true,
    },
  });

  const updateMutation = useUpdateFactoryShipmentOrderStatus();

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = (autoStartTracking: boolean) => {
    toast({
      title: '船公司信息已补充',
      description: autoStartTracking
        ? `订单 ${orderNumber} 已更新为运输中,系统将自动追踪货物状态`
        : `订单 ${orderNumber} 的船公司信息已保存`,
    });
    queryClient.invalidateQueries({
      queryKey: factoryShipmentQueryKeys.detail(orderId),
    });
    queryClient.invalidateQueries({
      queryKey: factoryShipmentQueryKeys.lists(),
    });
    form.reset();
    handleClose();
    onSuccess?.();
  };

  const handleError = (error: unknown) => {
    toast({
      title: '补充信息失败',
      description: error instanceof Error ? error.message : '操作失败,请重试',
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit(data => {
    // 如果勾选自动开始追踪,则更新为运输中状态
    const targetStatus = data.autoStartTracking
      ? FACTORY_SHIPMENT_STATUS.IN_TRANSIT
      : FACTORY_SHIPMENT_STATUS.SHIPPED;
    const estimatedArrivalIso = data.estimatedArrival
      ? data.estimatedArrival.toISOString()
      : undefined;

    updateMutation.mutate(
      {
        id: orderId,
        data: {
          idempotencyKey: crypto.randomUUID(),
          status: targetStatus,
          containerNumber,
          shippingCompany: data.shippingCompany,
          estimatedArrival: estimatedArrivalIso,
        },
      },
      {
        onSuccess: () => handleSuccess(data.autoStartTracking),
        onError: handleError,
      }
    );
  });

  return {
    updateMutation,
    form,
    handleCancel: handleClose,
    handleSubmit,
  };
}

function ShippingCompanyField({
  form,
  disabled,
}: {
  form: UseFormReturn<SupplementShippingInfoData>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shippingCompany"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            船公司名称 <span className="text-[hsl(var(--color-error))]">*</span>
          </FormLabel>
          <FormControl>
            <Input
              placeholder="例如: 马士基、中远海运等"
              {...field}
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>请向货运公司询问船公司名称</FormDescription>
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
  form: UseFormReturn<SupplementShippingInfoData>;
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
              placeholder="选择预计到达时间"
            />
          </FormControl>
          <FormDescription>可选,通常运输时间约6天</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function AutoStartTrackingField({
  form,
  disabled,
}: {
  form: UseFormReturn<SupplementShippingInfoData>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="autoStartTracking"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 space-y-0 rounded-lg border p-3">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
            />
          </FormControl>
          <div className="space-y-1">
            <FormLabel className="text-sm font-medium">
              自动开始追踪货物状态
            </FormLabel>
            <FormDescription className="text-xs">
              补充信息后自动更新为&quot;运输中&quot;,系统将定时查询货物位置
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  );
}

function SupplementShippingInfoDialogView({
  open,
  onOpenChange,
  orderNumber,
  containerNumber,
  form,
  isPending,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  containerNumber: string;
  form: UseFormReturn<SupplementShippingInfoData>;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            补充船公司信息
          </DialogTitle>
          <DialogDescription>
            订单 {orderNumber} 已发货,请补充船公司信息以便追踪货物
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* 显示集装箱号 */}
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-sm font-medium text-blue-900">
                集装箱号
              </AlertTitle>
              <AlertDescription className="mt-1 text-base font-semibold text-blue-900">
                {containerNumber}
              </AlertDescription>
            </Alert>

            <ShippingCompanyField form={form} disabled={isPending} />
            <EstimatedArrivalField form={form} disabled={isPending} />
            <AutoStartTrackingField form={form} disabled={isPending} />

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
                {isPending ? '提交中...' : '确认补充'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 补充船公司信息对话框组件
 * 用于已发货订单补充船公司信息,支持自动更新为运输中状态
 *
 * 特点:
 * 1. 轻量级,只需填写船公司名称
 * 2. 填写后可自动转为"运输中"状态
 * 3. 自动开始追踪货物状态
 */
export function SupplementShippingInfoDialog({
  orderId,
  orderNumber,
  containerNumber,
  open,
  onOpenChange,
  onSuccess,
}: SupplementShippingInfoDialogProps) {
  const { updateMutation, form, handleCancel, handleSubmit } =
    useSupplementShippingInfoDialogState({
      orderId,
      orderNumber,
      containerNumber,
      onOpenChange,
      onSuccess,
    });

  return (
    <SupplementShippingInfoDialogView
      open={open}
      onOpenChange={onOpenChange}
      orderNumber={orderNumber}
      containerNumber={containerNumber}
      form={form}
      isPending={updateMutation.isPending}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
  );
}

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useUpdateFactoryShipmentOrderShippingCompany } from '@/lib/api/factory-shipments';

// 船公司名称编辑表单验证规则
const editShippingCompanySchema = z.object({
  shippingCompany: z
    .string()
    .min(1, '船公司名称不能为空')
    .max(100, '船公司名称不能超过100个字符'),
});

type EditShippingCompanyData = z.infer<typeof editShippingCompanySchema>;

interface ShippingCompanyEditDialogProps {
  order: {
    id: string;
    orderNumber: string;
    shippingCompany: string | null;
    lastShippingQueryAt?: Date | string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ShippingCompanyEditDialogStateProps {
  order: ShippingCompanyEditDialogProps['order'];
  onOpenChange: ShippingCompanyEditDialogProps['onOpenChange'];
  onSuccess: ShippingCompanyEditDialogProps['onSuccess'];
}

function useShippingCompanyEditDialogState({
  order,
  onOpenChange,
  onSuccess,
}: ShippingCompanyEditDialogStateProps) {
  const { toast } = useToast();
  const form = useForm<EditShippingCompanyData>({
    resolver: standardSchemaResolver(editShippingCompanySchema),
    defaultValues: {
      shippingCompany: order.shippingCompany || '',
    },
  });

  const updateMutation = useUpdateFactoryShipmentOrderShippingCompany();

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = () => {
    toast({
      title: '更新成功',
      description: `订单 ${order.orderNumber} 的船公司名称已更新。`,
      variant: 'success',
    });
    form.reset();
    handleClose();
    onSuccess?.();
  };

  const handleError = (error: unknown) => {
    toast({
      title: '更新失败',
      description:
        error instanceof Error ? error.message : '更新船公司名称失败，请重试。',
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit(data => {
    updateMutation.mutate(
      {
        id: order.id,
        data: {
          shippingCompany: data.shippingCompany,
        },
      },
      {
        onSuccess: handleSuccess,
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
  isLocked,
}: {
  form: ReturnType<typeof useForm<EditShippingCompanyData>>;
  disabled?: boolean;
  isLocked?: boolean;
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
              {...field}
              placeholder="请输入船公司名称，例如：HE YUAN SHUN 98"
              disabled={disabled || isLocked}
            />
          </FormControl>
          <FormDescription>
            {isLocked ? (
              <span className="text-[hsl(var(--color-error))]">
                ⚠️
                订单已进行物流查询，不允许修改船运公司。如需修改，请联系管理员。
              </span>
            ) : (
              '输入负责运输的船公司名称，用于运输追踪和查询'
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ShippingCompanyEditDialogView({
  open,
  onOpenChange,
  orderNumber,
  form,
  isPending,
  isLocked,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  form: ReturnType<typeof useForm<EditShippingCompanyData>>;
  isPending: boolean;
  isLocked: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" /> 编辑船公司名称
          </DialogTitle>
          <DialogDescription>
            请更新订单 {orderNumber} 的船公司名称
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ShippingCompanyField
              form={form}
              disabled={isPending}
              isLocked={isLocked}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending || isLocked}>
                {isPending ? '更新中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 船公司名称编辑对话框组件
 * 用于在列表页直接编辑船公司名称
 */
export function ShippingCompanyEditDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: ShippingCompanyEditDialogProps) {
  const { updateMutation, form, handleCancel, handleSubmit } =
    useShippingCompanyEditDialogState({
      order,
      onOpenChange,
      onSuccess,
    });

  // 判断订单是否已查询（已锁定）
  const isLocked = Boolean(order.lastShippingQueryAt);
  const hasUnsavedChanges =
    open && form.formState.isDirty && !updateMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前船公司信息尚未保存，确定要关闭吗？',
  });

  const handleCloseAttempt = (nextOpen: boolean) => {
    if (!nextOpen && !confirmLeavePage()) {
      return;
    }

    onOpenChange(nextOpen);
  };

  const handleProtectedCancel = () => {
    if (!confirmLeavePage()) {
      return;
    }

    handleCancel();
  };

  return (
    <ShippingCompanyEditDialogView
      open={open}
      onOpenChange={handleCloseAttempt}
      orderNumber={order.orderNumber}
      form={form}
      isPending={updateMutation.isPending}
      isLocked={isLocked}
      onCancel={handleProtectedCancel}
      onSubmit={handleSubmit}
    />
  );
}

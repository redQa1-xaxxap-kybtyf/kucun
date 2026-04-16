'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Package } from 'lucide-react';
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
import { useUpdateFactoryShipmentOrderContainerNumber } from '@/lib/api/factory-shipments';

// 集装箱号编辑表单验证规则
const editContainerNumberSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '集装箱号码不能为空')
    .max(50, '集装箱号码不能超过50个字符'),
});

type EditContainerNumberData = z.infer<typeof editContainerNumberSchema>;

interface ContainerNumberEditDialogProps {
  order: {
    id: string;
    orderNumber: string;
    containerNumber: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ContainerNumberEditDialogStateProps {
  order: ContainerNumberEditDialogProps['order'];
  onOpenChange: ContainerNumberEditDialogProps['onOpenChange'];
  onSuccess: ContainerNumberEditDialogProps['onSuccess'];
}

function useContainerNumberEditDialogState({
  order,
  onOpenChange,
  onSuccess,
}: ContainerNumberEditDialogStateProps) {
  const { toast } = useToast();
  const form = useForm<EditContainerNumberData>({
    resolver: standardSchemaResolver(editContainerNumberSchema),
    defaultValues: {
      containerNumber: order.containerNumber || '',
    },
  });

  const updateMutation = useUpdateFactoryShipmentOrderContainerNumber();

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = () => {
    toast({
      title: '更新成功',
      description: `订单 ${order.orderNumber} 的集装箱号已更新。`,
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
        error instanceof Error ? error.message : '更新集装箱号失败，请重试。',
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit(data => {
    updateMutation.mutate(
      {
        id: order.id,
        data: {
          containerNumber: data.containerNumber,
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

function ContainerNumberField({
  form,
  disabled,
}: {
  form: ReturnType<typeof useForm<EditContainerNumberData>>;
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
              {...field}
              placeholder="请输入集装箱号码"
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>
            输入货运公司提供的集装箱号码，用于运输追踪
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ContainerNumberEditDialogView({
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
  form: ReturnType<typeof useForm<EditContainerNumberData>>;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> 编辑集装箱号
          </DialogTitle>
          <DialogDescription>
            请更新订单 {orderNumber} 的集装箱号码
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ContainerNumberField form={form} disabled={isPending} />

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
 * 集装箱号编辑对话框组件
 * 用于在列表页直接编辑集装箱号
 */
export function ContainerNumberEditDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: ContainerNumberEditDialogProps) {
  const { updateMutation, form, handleCancel, handleSubmit } =
    useContainerNumberEditDialogState({
      order,
      onOpenChange,
      onSuccess,
    });
  const hasUnsavedChanges =
    open && form.formState.isDirty && !updateMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前集装箱号尚未保存，确定要关闭吗？',
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
    <ContainerNumberEditDialogView
      open={open}
      onOpenChange={handleCloseAttempt}
      orderNumber={order.orderNumber}
      form={form}
      isPending={updateMutation.isPending}
      onCancel={handleProtectedCancel}
      onSubmit={handleSubmit}
    />
  );
}

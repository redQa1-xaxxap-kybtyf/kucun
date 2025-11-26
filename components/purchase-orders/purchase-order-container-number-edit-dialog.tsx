'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import * as React from 'react';
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
import { purchaseOrderQueryKeys } from '@/lib/api/purchase-orders';

// 集装箱号码编辑表单验证规则
const editPurchaseOrderContainerNumberSchema = z.object({
  containerNumber: z
    .string()
    .min(1, '集装箱号不能为空')
    .max(50, '集装箱号不能超过50个字符'),
});

type EditPurchaseOrderContainerNumberData = z.infer<
  typeof editPurchaseOrderContainerNumberSchema
>;

interface PurchaseOrderContainerNumberEditDialogProps {
  order: {
    id: string;
    orderNumber: string;
    containerNumber: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PurchaseOrderContainerNumberEditDialogStateProps {
  order: PurchaseOrderContainerNumberEditDialogProps['order'];
  onOpenChange: PurchaseOrderContainerNumberEditDialogProps['onOpenChange'];
  onSuccess: PurchaseOrderContainerNumberEditDialogProps['onSuccess'];
}

function usePurchaseOrderContainerNumberEditDialogState({
  order,
  onOpenChange,
  onSuccess,
}: PurchaseOrderContainerNumberEditDialogStateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<EditPurchaseOrderContainerNumberData>({
    resolver: standardSchemaResolver(editPurchaseOrderContainerNumberSchema),
    defaultValues: {
      containerNumber: order.containerNumber || '',
    },
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = () => {
    toast({
      title: '更新成功',
      description: `采购订单 ${order.orderNumber} 的集装箱号已更新。`,
      variant: 'success',
    });
    form.reset();
    handleClose();
    onSuccess?.();
    queryClient.invalidateQueries({
      queryKey: purchaseOrderQueryKeys.all,
    });
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
    setIsSubmitting(true);
    fetch(`/api/purchase-orders/${order.id}/shipping`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        containerNumber: data.containerNumber,
      }),
    })
      .then(async response => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || '更新采购订单失败');
        }
        return response.json();
      })
      .then(() => {
        handleSuccess();
      })
      .catch(handleError)
      .finally(() => {
        setIsSubmitting(false);
      });
  });

  return {
    form,
    isSubmitting,
    handleCancel: handleClose,
    handleSubmit,
  };
}

function ContainerNumberField({
  form,
  disabled,
}: {
  form: ReturnType<typeof useForm<EditPurchaseOrderContainerNumberData>>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="containerNumber"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            集装箱号 <span className="text-[hsl(var(--color-error))]">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入集装箱号，例如：CONT-2025-001"
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>
            填写货运公司提供的集装箱号，便于后续到货和运输跟踪。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PurchaseOrderContainerNumberEditDialogView({
  open,
  onOpenChange,
  orderNumber,
  form,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  form: ReturnType<typeof useForm<EditPurchaseOrderContainerNumberData>>;
  isSubmitting: boolean;
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
            请更新采购订单 {orderNumber} 的集装箱号。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ContainerNumberField form={form} disabled={isSubmitting} />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? '更新中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 仓库进货采购单 - 集装箱号编辑对话框
 * 用于在采购订单列表中直接修改集装箱号
 */
export function PurchaseOrderContainerNumberEditDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: PurchaseOrderContainerNumberEditDialogProps) {
  const { form, isSubmitting, handleCancel, handleSubmit } =
    usePurchaseOrderContainerNumberEditDialogState({
      order,
      onOpenChange,
      onSuccess,
    });

  return (
    <PurchaseOrderContainerNumberEditDialogView
      open={open}
      onOpenChange={onOpenChange}
      orderNumber={order.orderNumber}
      form={form}
      isSubmitting={isSubmitting}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
  );
}

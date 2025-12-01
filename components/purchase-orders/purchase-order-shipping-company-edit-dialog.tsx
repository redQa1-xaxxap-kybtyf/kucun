'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { Ship } from 'lucide-react';
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
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

// 仓库进货采购单的船运公司编辑表单验证规则
const editPurchaseOrderShippingCompanySchema = z.object({
  shippingCompany: z
    .string()
    .min(1, '船运公司名称不能为空')
    .max(100, '船运公司名称不能超过100个字符'),
});

type EditPurchaseOrderShippingCompanyData = z.infer<
  typeof editPurchaseOrderShippingCompanySchema
>;

interface PurchaseOrderShippingCompanyEditDialogProps {
  order: {
    id: string;
    orderNumber: string;
    shippingCompany: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PurchaseOrderShippingCompanyEditDialogStateProps {
  order: PurchaseOrderShippingCompanyEditDialogProps['order'];
  onOpenChange: PurchaseOrderShippingCompanyEditDialogProps['onOpenChange'];
  onSuccess: PurchaseOrderShippingCompanyEditDialogProps['onSuccess'];
}

function usePurchaseOrderShippingCompanyEditDialogState({
  order,
  onOpenChange,
  onSuccess,
}: PurchaseOrderShippingCompanyEditDialogStateProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<EditPurchaseOrderShippingCompanyData>({
    resolver: standardSchemaResolver(editPurchaseOrderShippingCompanySchema),
    defaultValues: {
      shippingCompany: order.shippingCompany || '',
    },
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSuccess = () => {
    toast({
      title: '更新成功',
      description: `采购订单 ${order.orderNumber} 的船运公司已更新。`,
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
        error instanceof Error ? error.message : '更新船运公司失败，请重试。',
      variant: 'destructive',
    });
  };

  const handleSubmit = form.handleSubmit(data => {
    setIsSubmitting(true);
    fetch(
      `/api/purchase-orders/${order.id}/shipping`,
      getCsrfTokenHeader({
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingCompany: data.shippingCompany,
        }),
      })
    )
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

function ShippingCompanyField({
  form,
  disabled,
}: {
  form: ReturnType<typeof useForm<EditPurchaseOrderShippingCompanyData>>;
  disabled?: boolean;
}) {
  return (
    <FormField
      control={form.control}
      name="shippingCompany"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            船运公司名称{' '}
            <span className="text-[hsl(var(--color-error))]">*</span>
          </FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder="请输入船运公司名称，例如：HE YUAN SHUN 98"
              disabled={disabled}
            />
          </FormControl>
          <FormDescription>
            输入负责运输的船运公司名称，便于后续到货跟踪。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function PurchaseOrderShippingCompanyEditDialogView({
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
  form: ReturnType<typeof useForm<EditPurchaseOrderShippingCompanyData>>;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" /> 编辑船运公司
          </DialogTitle>
          <DialogDescription>
            请更新采购订单 {orderNumber} 的船运公司信息。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <ShippingCompanyField form={form} disabled={isSubmitting} />

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
 * 仓库进货采购单 - 船运公司编辑对话框
 * 用于在采购订单列表中直接修改船运公司名称
 */
export function PurchaseOrderShippingCompanyEditDialog({
  order,
  open,
  onOpenChange,
  onSuccess,
}: PurchaseOrderShippingCompanyEditDialogProps) {
  const { form, isSubmitting, handleCancel, handleSubmit } =
    usePurchaseOrderShippingCompanyEditDialogState({
      order,
      onOpenChange,
      onSuccess,
    });

  return (
    <PurchaseOrderShippingCompanyEditDialogView
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

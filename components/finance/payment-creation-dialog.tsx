/**
 * 收款记录创建对话框
 * 用于在应收账款列表中快速创建收款记录
 * 严格遵循代码质量规范和组件化设计原则
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DollarSign } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  useForm,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';

import { OrderSummaryCard } from './order-summary-card';
import { PaymentForm } from './payment-creation-dialog-form';
import {
  paymentSchema,
  type OrderInfo,
  type PaymentFormData,
} from './payment-creation-dialog.config';

interface PaymentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderInfo: OrderInfo | null;
}

interface UsePaymentDialogStateResult {
  form: UseFormReturn<PaymentFormData>;
  enableRounding: boolean;
  paymentMethod: PaymentFormData['paymentMethod'];
  handleDialogOpenChange: (open: boolean) => void;
  handleRoundingToggle: (checked: boolean) => void;
}

function usePaymentDialogState(
  orderInfo: OrderInfo | null,
  onOpenChange: (open: boolean) => void
): UsePaymentDialogStateResult {
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentType: 'order_payment',
      salesOrderId: '',
      customerId: '',
      paymentMethod: 'cash',
      paymentAmount: 0,
      actualPaymentAmount: 0,
      roundingAmount: 0,
      paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      bankInfo: '',
      remarks: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const paymentAmount = form.watch('paymentAmount');
  const actualPaymentAmount = form.watch('actualPaymentAmount');

  const [enableRounding, setEnableRounding] = useState(false);

  useEffect(() => {
    if (orderInfo) {
      form.reset({
        paymentType: 'order_payment',
        salesOrderId: orderInfo.id,
        customerId: orderInfo.customerId,
        paymentMethod: 'cash',
        paymentAmount: orderInfo.remainingAmount,
        actualPaymentAmount: orderInfo.remainingAmount,
        roundingAmount: 0,
        paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        bankInfo: '',
        remarks: '',
      });
      setEnableRounding(false);
    }
  }, [orderInfo, form]);

  useEffect(() => {
    if (typeof paymentAmount === 'number' && !Number.isNaN(paymentAmount)) {
      if (!enableRounding) {
        const currentActual = form.getValues('actualPaymentAmount');
        if (currentActual !== paymentAmount) {
          form.setValue('actualPaymentAmount', paymentAmount, {
            shouldValidate: false,
          });
          form.setValue('roundingAmount', 0, { shouldValidate: false });
        }
      }
    }
  }, [enableRounding, form, paymentAmount]);

  useEffect(() => {
    if (enableRounding) {
      if (
        typeof paymentAmount === 'number' &&
        !Number.isNaN(paymentAmount) &&
        typeof actualPaymentAmount === 'number' &&
        !Number.isNaN(actualPaymentAmount)
      ) {
        const rounding = Number(
          (paymentAmount - actualPaymentAmount).toFixed(2)
        );
        if (rounding !== form.getValues('roundingAmount')) {
          form.setValue('roundingAmount', rounding, { shouldValidate: false });
        }
      }
    }
  }, [enableRounding, form, paymentAmount, actualPaymentAmount]);

  const handleDialogOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        form.reset();
        setEnableRounding(false);
      }
      onOpenChange(newOpen);
    },
    [form, onOpenChange]
  );

  const handleRoundingToggle = useCallback(
    (checked: boolean) => {
      setEnableRounding(checked);
      if (!checked) {
        const currentPayment = form.getValues('paymentAmount');
        form.setValue('actualPaymentAmount', currentPayment, {
          shouldValidate: false,
        });
        form.setValue('roundingAmount', 0, { shouldValidate: false });
      }
    },
    [form]
  );

  return {
    form,
    enableRounding,
    paymentMethod,
    handleDialogOpenChange,
    handleRoundingToggle,
  };
}

export function PaymentCreationDialog({
  open,
  onOpenChange,
  orderInfo,
}: PaymentCreationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    form,
    enableRounding,
    paymentMethod,
    handleDialogOpenChange,
    handleRoundingToggle,
  } = usePaymentDialogState(orderInfo, onOpenChange);

  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      // ✅ 解析响应体（可能抛出异常）
      let result;
      try {
        result = await response.json();
      } catch (_parseError) {
        throw new Error('服务器响应格式错误');
      }

      // ✅ 检查HTTP状态码
      if (!response.ok) {
        throw new Error(result.error || '创建收款记录失败');
      }

      // ✅ 检查业务状态码（后端返回 { success, data, error }）
      if (result.success === false) {
        throw new Error(result.error || '创建收款记录失败');
      }

      return result;
    },
    onSuccess: data => {
      // ✅ 先显示成功提示
      toast({
        title: '创建成功',
        description: data.message || '收款记录已成功创建',
        variant: 'success',
      });

      // ✅ 关闭对话框
      handleDialogOpenChange(false);

      // ✅ 异步失效缓存（不阻塞UI）
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.finance.receivables(),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.payments.all,
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.finance.overview(),
        }),
      ]).catch(error => {
        // 缓存失效失败不影响用户体验，只记录日志
        console.error('缓存失效失败:', error);
      });
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit: SubmitHandler<PaymentFormData> = data => {
    createPaymentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            创建收款记录
          </DialogTitle>
          <DialogDescription>
            为订单创建收款记录，填写实际收款信息
          </DialogDescription>
        </DialogHeader>

        {orderInfo && <OrderSummaryCard orderInfo={orderInfo} />}

        <PaymentForm
          form={form}
          enableRounding={enableRounding}
          paymentMethod={paymentMethod}
          onRoundingToggle={handleRoundingToggle}
          onSubmit={handleSubmit}
          onCancel={() => handleDialogOpenChange(false)}
          isSubmitting={createPaymentMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

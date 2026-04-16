/**
 * 收款记录创建对话框
 * 用于在应收账款列表中快速创建收款记录
 * 严格遵循代码质量规范和组件化设计原则
 */

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
import { queryKeys } from '@/lib/queryKeys';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';

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

// 自动同步收款金额和实际收款金额
function useAutoSyncAmounts(
  form: UseFormReturn<PaymentFormData>,
  enableRounding: boolean,
  paymentAmount: number,
  actualPaymentAmount: number
) {
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
}

function usePaymentDialogState(
  orderInfo: OrderInfo | null,
  onOpenChange: (open: boolean) => void
): UsePaymentDialogStateResult {
  const form = useForm<PaymentFormData>({
    resolver: standardSchemaResolver(paymentSchema),
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
      receiptNumber: '',
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
        receiptNumber: '',
      });
      setEnableRounding(false);
    }
  }, [orderInfo, form]);

  useAutoSyncAmounts(form, enableRounding, paymentAmount, actualPaymentAmount);

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
      const response = await fetch(
        '/api/payments',
        getCsrfTokenHeader({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })
      );

      // ✅ 解析响应体（可能抛出异常）
      let result;
      try {
        result = await response.json();
      } catch (_parseError) {
        throw new Error('服务器响应格式错误');
      }

      // ✅ 检查HTTP状态码
      if (!response.ok) {
        throw new Error(result?.error || '创建收款记录失败');
      }

      // ✅ 严格检查业务状态码（后端返回 { success, data, error }）
      // 必须明确返回 success: true 才算成功
      if (result?.success !== true) {
        throw new Error(result?.error || '创建收款记录失败：服务器响应异常');
      }

      // ✅ 验证返回数据完整性
      if (!result.data) {
        throw new Error('创建收款记录失败：返回数据不完整');
      }

      return result;
    },
    onSuccess: () => {
      // ✅ 先显示成功提示
      toast({
        title: '收款已登记',
        description: '这笔收款已登记为待确认到账',
        variant: 'success',
      });

      // ✅ 关闭对话框
      handleDialogOpenChange(false);

      // ✅ 使用统一的缓存刷新工具函数
      invalidateFinanceCaches(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.overview(),
      });
    },
    onError: (error: Error) => {
      toast({
        title: '登记失败',
        description: getFriendlyErrorMessage(
          error,
          '这笔收款暂时无法登记，请稍后重试'
        ),
        variant: 'destructive',
      });
    },
  });
  const hasUnsavedChanges =
    open && form.formState.isDirty && !createPaymentMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前收款内容尚未保存，确定要关闭吗？',
  });

  const handleCloseAttempt = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !confirmLeavePage()) {
        return;
      }

      handleDialogOpenChange(nextOpen);
    },
    [confirmLeavePage, handleDialogOpenChange]
  );

  const handleSubmit: SubmitHandler<PaymentFormData> = data => {
    createPaymentMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseAttempt}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            登记待确认收款
          </DialogTitle>
          <DialogDescription>
            先登记这笔收款，核对无误后再确认到账
          </DialogDescription>
        </DialogHeader>

        {orderInfo && <OrderSummaryCard orderInfo={orderInfo} />}

        <PaymentForm
          form={form}
          enableRounding={enableRounding}
          paymentMethod={paymentMethod}
          onRoundingToggle={handleRoundingToggle}
          onSubmit={handleSubmit}
          onCancel={() => handleCloseAttempt(false)}
          isSubmitting={createPaymentMutation.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

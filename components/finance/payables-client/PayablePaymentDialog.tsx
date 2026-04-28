'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import { useCallback, useEffect, type BaseSyntheticEvent } from 'react';
import {
  useForm,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { payablesApi } from '@/lib/api/payables';
import { queryKeys } from '@/lib/queryKeys';
import type { PayableRecordDetail } from '@/lib/types/payable';
import { formatDate as formatDateUtil } from '@/lib/utils/datetime';
import { computePaymentOutRounding } from '@/lib/utils/payment-out-amounts';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import {
  PAYMENT_OUT_METHODS,
  paymentOutMethodSchema,
} from '@/lib/validations/payable';

const paymentFormSchema = z
  .object({
    idempotencyKey: z.string().uuid('页面已过期，请关闭后重新打开'),
    payableRecordId: z.string().min(1, '没有找到对应应付款'),
    supplierId: z.string().min(1, '请选择供应商'),
    paymentAmount: z.number().min(0.01, '付款金额必须大于 0'),
    actualPaymentAmount: z.number().min(0, '实际付款金额不能小于 0'),
    roundingAmount: z.number(),
    paymentMethod: paymentOutMethodSchema,
    paymentDate: z.string().min(1, '请选择付款日期'),
    bankInfo: z.string().optional(),
    remarks: z.string().max(200, '备注不能超过200个字符').optional(),
  })
  .refine(
    value =>
      Math.abs(
        Number(
          (
            value.actualPaymentAmount +
            value.roundingAmount -
            value.paymentAmount
          ).toFixed(2)
        )
      ) < 0.01,
    {
      message: '请检查金额，记账金额应等于实际付款和抹零金额之和',
      path: ['actualPaymentAmount'],
    }
  );

type PaymentFormData = z.infer<typeof paymentFormSchema>;

type PayableInfo = Pick<
  PayableRecordDetail,
  | 'id'
  | 'payableNumber'
  | 'supplier'
  | 'payableAmount'
  | 'paidAmount'
  | 'remainingAmount'
  | 'dueDate'
>;

interface PayablePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payableInfo: PayableInfo | null;
}

const PAYMENT_METHOD_DETAILS: {
  [key: string]: { label: string; icon: string };
} = {
  cash: { label: '现金', icon: '💵' },
  bank_transfer: { label: '银行转账', icon: '🏦' },
  alipay: { label: '支付宝', icon: '💳' },
  wechat: { label: '微信支付', icon: '📱' },
  check: { label: '支票', icon: '📄' },
  other: { label: '其他', icon: '🔁' },
};

// 使用付款模态框状态的Hook
function usePaymentDialogState(
  payableInfo: PayableInfo | null,
  open: boolean,
  onOpenChange: (open: boolean) => void
) {
  const form = useForm<PaymentFormData>({
    resolver: standardSchemaResolver(paymentFormSchema),
    defaultValues: {
      idempotencyKey: crypto.randomUUID(),
      payableRecordId: '',
      supplierId: '',
      paymentAmount: 0,
      actualPaymentAmount: 0,
      roundingAmount: 0,
      paymentMethod: 'bank_transfer',
      paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      bankInfo: '',
      remarks: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');
  const paymentAmount = form.watch('paymentAmount');
  const actualPaymentAmount = form.watch('actualPaymentAmount');

  useEffect(() => {
    if (!open) {
      return;
    }

    if (payableInfo) {
      form.reset({
        idempotencyKey: crypto.randomUUID(),
        payableRecordId: payableInfo.id,
        supplierId: payableInfo.supplier?.id ?? '',
        paymentAmount: payableInfo.remainingAmount,
        actualPaymentAmount: payableInfo.remainingAmount,
        roundingAmount: 0,
        paymentMethod: 'bank_transfer',
        paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        bankInfo: '',
        remarks: '',
      });
    }
  }, [open, payableInfo, form]);

  useEffect(() => {
    if (
      typeof paymentAmount !== 'number' ||
      Number.isNaN(paymentAmount) ||
      typeof actualPaymentAmount !== 'number' ||
      Number.isNaN(actualPaymentAmount)
    ) {
      return;
    }

    const rounding = computePaymentOutRounding(
      paymentAmount,
      actualPaymentAmount
    );

    if (form.getValues('roundingAmount') !== rounding) {
      form.setValue('roundingAmount', rounding, { shouldValidate: true });
    }
  }, [actualPaymentAmount, form, paymentAmount]);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        form.reset();
      }
      onOpenChange(open);
    },
    [form, onOpenChange]
  );

  return {
    form,
    paymentMethod,
    handleDialogOpenChange,
  };
}

// 付款提交Mutation
function usePaymentMutation(onSuccess: () => void) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: payablesApi.createPaymentOutRecord,
    onSuccess: () => {
      toast({
        title: '付款已登记',
        description: '这笔付款已经保存，并记为已付款',
        variant: 'success',
      });

      // 刷新应付款列表数据
      queryClient.invalidateQueries({ queryKey: queryKeys.payables.lists() });

      onSuccess();
    },
    onError: error => {
      toast({
        title: '付款失败',
        description: getFriendlyErrorMessage(
          error,
          '这笔付款暂时保存不了，请稍后再试'
        ),
        variant: 'destructive',
      });
    },
  });
}

// 应付款信息展示组件
function PayableInfoCard({ payableInfo }: { payableInfo: PayableInfo }) {
  return (
    <div className="bg-muted/30 rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--color-primary))]">
          <ChineseYuan className="h-4 w-4 text-white" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">{payableInfo.payableNumber}</h4>
          <p className="text-muted-foreground text-xs">
            {payableInfo.supplier?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">应付金额</p>
          <p className="font-semibold">
            {formatCurrency(payableInfo.payableAmount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">已付款金额</p>
          <p className="font-semibold text-green-600">
            {formatCurrency(payableInfo.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-1">待付金额</p>
          <p className="font-semibold text-orange-600">
            {formatCurrency(payableInfo.remainingAmount)}
          </p>
        </div>
      </div>

      {payableInfo.dueDate && (
        <div className="mt-3 border-t pt-3">
          <p className="text-muted-foreground text-xs">
            到期日: {formatDateUtil(payableInfo.dueDate)}
          </p>
        </div>
      )}
    </div>
  );
}

const PaymentAmountField = ({
  form,
  payableInfo,
}: {
  form: UseFormReturn<PaymentFormData>;
  payableInfo: PayableInfo;
}) => (
  <FormField
    control={form.control}
    name="paymentAmount"
    render={({ field }) => (
      <FormItem>
        <FormLabel>付款金额</FormLabel>
        <FormControl>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={payableInfo.remainingAmount}
            placeholder="请输入付款金额"
            {...field}
            onChange={event =>
              field.onChange(parseFloat(event.target.value) || 0)
            }
          />
        </FormControl>
        <FormMessage />
        <p className="text-muted-foreground text-xs">
          最大可付款金额: {formatCurrency(payableInfo.remainingAmount)}
        </p>
      </FormItem>
    )}
  />
);

const PaymentMethodField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="paymentMethod"
    render={({ field }) => (
      <FormItem>
        <FormLabel>付款方式</FormLabel>
        <Select onValueChange={field.onChange} defaultValue={field.value}>
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="请选择付款方式" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {PAYMENT_OUT_METHODS.map(method => {
              const details = PAYMENT_METHOD_DETAILS[method];
              return (
                <SelectItem key={method} value={method}>
                  <div className="flex items-center gap-2">
                    <span>{details.icon}</span>
                    <span>{details.label}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />
);

const ActualPaymentAmountField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="actualPaymentAmount"
    render={({ field }) => (
      <FormItem>
        <FormLabel>实际付款金额</FormLabel>
        <FormControl>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="请输入实际付款金额"
            {...field}
            onChange={event =>
              field.onChange(parseFloat(event.target.value) || 0)
            }
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const RoundingAmountField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="roundingAmount"
    render={({ field }) => (
      <FormItem>
        <FormLabel>抹零金额</FormLabel>
        <FormControl>
          <Input
            readOnly
            type="number"
            step="0.01"
            value={field.value?.toFixed(2) ?? '0.00'}
            className="bg-muted"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const PaymentDateField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="paymentDate"
    render={({ field }) => (
      <FormItem>
        <FormLabel>付款日期</FormLabel>
        <FormControl>
          <Input type="datetime-local" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const PaymentBankInfoField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="bankInfo"
    render={({ field }) => (
      <FormItem>
        <FormLabel>银行信息</FormLabel>
        <FormControl>
          <Textarea
            placeholder="请输入银行账户信息"
            className="resize-none"
            rows={3}
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const PaymentRemarksField = ({
  form,
}: {
  form: UseFormReturn<PaymentFormData>;
}) => (
  <FormField
    control={form.control}
    name="remarks"
    render={({ field }) => (
      <FormItem>
        <FormLabel>备注（可选）</FormLabel>
        <FormControl>
          <Textarea
            placeholder="付款备注"
            className="resize-none"
            rows={3}
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

// 付款表单组件
function PaymentForm({
  form,
  paymentMethod,
  payableInfo,
  formId,
  onSubmit,
}: {
  form: UseFormReturn<PaymentFormData>;
  paymentMethod: PaymentFormData['paymentMethod'];
  payableInfo: PayableInfo;
  formId: string;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
}) {
  return (
    <Form {...form}>
      <form id={formId} onSubmit={onSubmit} className="space-y-4">
        {/* 应付款信息展示 */}
        <PayableInfoCard payableInfo={payableInfo} />

        <PaymentAmountField form={form} payableInfo={payableInfo} />
        <ActualPaymentAmountField form={form} />
        <RoundingAmountField form={form} />
        <PaymentMethodField form={form} />
        <PaymentDateField form={form} />
        {paymentMethod === 'bank_transfer' && (
          <PaymentBankInfoField form={form} />
        )}
        <PaymentRemarksField form={form} />
      </form>
    </Form>
  );
}

export function PayablePaymentDialog({
  open,
  onOpenChange,
  payableInfo,
}: PayablePaymentDialogProps) {
  const paymentFormId = 'payable-payment-form';
  const { form, paymentMethod, handleDialogOpenChange } = usePaymentDialogState(
    payableInfo,
    open,
    onOpenChange
  );

  const paymentMutation = usePaymentMutation(() => {
    handleDialogOpenChange(false);
  });
  const hasUnsavedChanges =
    open && form.formState.isDirty && !paymentMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前付款内容尚未保存，确定要关闭吗？',
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

  const handleSubmit: SubmitHandler<PaymentFormData> = useCallback(
    data => {
      if (!payableInfo) return;

      // 验证付款金额不能超过待付金额
      if (data.paymentAmount > payableInfo.remainingAmount) {
        form.setError('paymentAmount', {
          type: 'manual',
          message: `付款金额不能超过待付金额 ${formatCurrency(payableInfo.remainingAmount)}`,
        });
        return;
      }

      // 创建付款记录
      paymentMutation.mutate({
        idempotencyKey: data.idempotencyKey,
        payableRecordId: data.payableRecordId,
        supplierId: data.supplierId,
        paymentAmount: data.paymentAmount,
        actualPaymentAmount: data.actualPaymentAmount,
        roundingAmount: data.roundingAmount,
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate,
        bankInfo: data.bankInfo,
        remarks: data.remarks,
      });
    },
    [form, payableInfo, paymentMutation]
  );

  const onSubmit = form.handleSubmit(handleSubmit);

  if (!payableInfo) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleCloseAttempt}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            登记付款并确认完成
          </DialogTitle>
          <DialogDescription>
            为应付款单 {payableInfo.payableNumber}{' '}
            登记这次付款，保存后会直接记为已付款
          </DialogDescription>
        </DialogHeader>

        <PaymentForm
          form={form}
          paymentMethod={paymentMethod}
          payableInfo={payableInfo}
          formId={paymentFormId}
          onSubmit={onSubmit}
        />

        <DialogFooter>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
            onClick={() => handleCloseAttempt(false)}
            disabled={paymentMutation.isPending}
          >
            取消
          </button>
          <button
            type="submit"
            form={paymentFormId}
            className="rounded-md border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? '保存中...' : '保存并确认付款'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 辅助函数：格式化货币
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
}

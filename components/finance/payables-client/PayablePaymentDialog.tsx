'use client';
import { ChineseYuan } from '@/components/icons/chinese-yuan';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import {
  useForm,
  type SubmitHandler,
  type UseFormReturn,
} from 'react-hook-form';
import { z } from 'zod';

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
import { payableQueryKeys, payablesApi } from '@/lib/api/payables';
import type { PayableRecordDetail } from '@/lib/types/payable';

const paymentFormSchema = z.object({
  payableRecordId: z.string().min(1, '应付款ID不能为空'),
  supplierId: z.string().min(1, '供应商ID不能为空'),
  paymentAmount: z.number().min(0.01, '付款金额必须大于0'),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'other'] as const),
  paymentDate: z.string().min(1, '请选择付款日期'),
  bankInfo: z.string().optional(),
  remarks: z.string().max(200, '备注不能超过200个字符').optional(),
});

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

// 付款方式选项
const PAYMENT_METHODS = [
  { value: 'cash', label: '现金', icon: '💵' },
  { value: 'bank_transfer', label: '银行转账', icon: '🏦' },
  { value: 'check', label: '支票', icon: '📄' },
  { value: 'other', label: '其他', icon: '🔁' },
] as const;

// 使用付款模态框状态的Hook
function usePaymentDialogState(
  payableInfo: PayableInfo | null,
  onOpenChange: (open: boolean) => void
) {
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      payableRecordId: '',
      supplierId: '',
      paymentAmount: 0,
      paymentMethod: 'bank_transfer',
      paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      bankInfo: '',
      remarks: '',
    },
  });

  const paymentMethod = form.watch('paymentMethod');

  useEffect(() => {
    if (payableInfo) {
      form.reset({
        payableRecordId: payableInfo.id,
        supplierId: payableInfo.supplier?.id ?? '',
        paymentAmount: payableInfo.remainingAmount,
        paymentMethod: 'bank_transfer',
        paymentDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        bankInfo: '',
        remarks: '',
      });
    }
  }, [payableInfo, form]);

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
        title: '付款成功',
        description: '付款记录已创建成功',
        variant: 'success',
      });

      // 刷新应付款列表数据
      queryClient.invalidateQueries({ queryKey: payableQueryKeys.lists() });

      onSuccess();
    },
    onError: error => {
      toast({
        title: '付款失败',
        description:
          error instanceof Error ? error.message : '创建付款记录时发生错误',
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
          <p className="text-muted-foreground mb-1">已付金额</p>
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
            到期日: {formatDateTime(payableInfo.dueDate, 'yyyy-MM-dd')}
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
            {PAYMENT_METHODS.map(method => (
              <SelectItem key={method.value} value={method.value}>
                <div className="flex items-center gap-2">
                  <span>{method.icon}</span>
                  <span>{method.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
            placeholder="请输入付款备注信息"
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
}: {
  form: UseFormReturn<PaymentFormData>;
  paymentMethod: PaymentFormData['paymentMethod'];
  payableInfo: PayableInfo;
}) {
  return (
    <Form {...form}>
      <div className="space-y-4">
        {/* 应付款信息展示 */}
        <PayableInfoCard payableInfo={payableInfo} />

        <PaymentAmountField form={form} payableInfo={payableInfo} />
        <PaymentMethodField form={form} />
        <PaymentDateField form={form} />
        {paymentMethod === 'bank_transfer' && (
          <PaymentBankInfoField form={form} />
        )}
        <PaymentRemarksField form={form} />
      </div>
    </Form>
  );
}

export function PayablePaymentDialog({
  open,
  onOpenChange,
  payableInfo,
}: PayablePaymentDialogProps) {
  const { form, paymentMethod, handleDialogOpenChange } = usePaymentDialogState(
    payableInfo,
    onOpenChange
  );

  const paymentMutation = usePaymentMutation(() => {
    handleDialogOpenChange(false);
  });

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
        payableRecordId: data.payableRecordId,
        supplierId: data.supplierId,
        paymentAmount: data.paymentAmount,
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
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            付款记录创建
          </DialogTitle>
          <DialogDescription>
            为应付款记录 {payableInfo.payableNumber} 创建付款记录
          </DialogDescription>
        </DialogHeader>

        <PaymentForm
          form={form}
          paymentMethod={paymentMethod}
          payableInfo={payableInfo}
        />

        <DialogFooter>
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none"
            onClick={() => handleDialogOpenChange(false)}
            disabled={paymentMutation.isPending}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-md border border-transparent bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSubmit}
            disabled={paymentMutation.isPending}
          >
            {paymentMutation.isPending ? '处理中...' : '确认付款'}
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

// 辅助函数：格式化日期时间
function formatDateTime(
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd HH:mm'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return '';
  }

  if (formatStr === 'yyyy-MM-dd') {
    return d.toLocaleDateString('zh-CN');
  }

  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

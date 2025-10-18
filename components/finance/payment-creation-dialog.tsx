/**
 * 收款记录创建对话框
 * 用于在应收账款列表中快速创建收款记录
 * 严格遵循代码质量规范和组件化设计原则
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { DollarSign, Save } from 'lucide-react';
import { useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/lib/queryKeys';
import { formatCurrency } from '@/lib/utils';

// 收款记录表单验证Schema
const paymentSchema = z.object({
  paymentType: z.literal('order_payment').default('order_payment'),
  salesOrderId: z.string().min(1, { message: '销售订单ID不能为空' }),
  customerId: z.string().min(1, { message: '客户ID不能为空' }),
  paymentMethod: z.enum(['cash', 'bank_transfer', 'check', 'other'], {
    message: '请选择收款方式',
  }),
  paymentAmount: z.number().min(0.01, { message: '收款金额必须大于0' }),
  paymentDate: z.string().min(1, { message: '请选择收款日期' }),
  bankInfo: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface OrderInfo {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

interface PaymentCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderInfo: OrderInfo | null;
}

/**
 * 收款方式映射
 */
const PAYMENT_METHODS = [
  { value: 'cash', label: '现金' },
  { value: 'bank_transfer', label: '银行转账' },
  { value: 'check', label: '支票' },
  { value: 'other', label: '其他' },
] as const;

/**
 * 收款记录创建对话框组件
 */
export function PaymentCreationDialog({
  open,
  onOpenChange,
  orderInfo,
}: PaymentCreationDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      paymentType: 'order_payment',
      salesOrderId: '',
      customerId: '',
      paymentMethod: 'cash',
      paymentAmount: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      bankInfo: '',
      remarks: '',
    },
  });

  const watchedPaymentMethod = form.watch('paymentMethod');

  // 当订单信息变化时，更新表单默认值
  useEffect(() => {
    if (orderInfo) {
      form.reset({
        paymentType: 'order_payment',
        salesOrderId: orderInfo.id,
        customerId: orderInfo.customerId,
        paymentMethod: 'cash',
        paymentAmount: orderInfo.remainingAmount,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        bankInfo: '',
        remarks: '',
      });
    }
  }, [orderInfo, form]);

  // 创建收款记录mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: PaymentFormData) => {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建收款记录失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '创建成功',
        description: '收款记录已成功创建',
        variant: 'success',
      });

      // 刷新应收账款列表
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivablesList({}),
      });

      // 关闭对话框并重置表单
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 提交表单处理
  const onSubmit = (data: PaymentFormData) => {
    createPaymentMutation.mutate(data);
  };

  // 关闭对话框时重置表单
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        {/* 订单信息摘要 */}
        {orderInfo && (
          <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-4">
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  订单号
                </span>
                <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  {orderInfo.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  客户名称
                </span>
                <span className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
                  {orderInfo.customerName}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  订单金额
                </span>
                <span className="text-base font-bold text-[hsl(var(--color-text-primary))]">
                  {formatCurrency(orderInfo.totalAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  已收金额
                </span>
                <span className="text-sm text-[hsl(var(--color-success))]">
                  {formatCurrency(orderInfo.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                  待收金额
                </span>
                <span className="text-lg font-bold text-[hsl(var(--color-warning))]">
                  {formatCurrency(orderInfo.remainingAmount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 收款表单 */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* 收款方式 */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>收款方式 *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择收款方式" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map(method => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 收款金额 */}
            <FormField
              control={form.control}
              name="paymentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>收款金额 *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...field}
                      onChange={e =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormDescription>实际收到的金额</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 收款日期 */}
            <FormField
              control={form.control}
              name="paymentDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>收款日期 *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 银行信息（仅在银行转账或支票时显示） */}
            {(watchedPaymentMethod === 'bank_transfer' ||
              watchedPaymentMethod === 'check') && (
              <FormField
                control={form.control}
                name="bankInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>银行信息</FormLabel>
                    <FormControl>
                      <Input placeholder="银行名称、账号等信息" {...field} />
                    </FormControl>
                    <FormDescription>银行转账或支票的相关信息</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* 备注 */}
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="收款相关的备注信息"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={createPaymentMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createPaymentMutation.isPending}
                className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90"
              >
                <Save className="mr-2 h-4 w-4" />
                {createPaymentMutation.isPending ? '创建中...' : '创建收款记录'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

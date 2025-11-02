'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useConfirmPayment, useCreatePaymentRecord } from '@/lib/api/payments';
import { queryKeys } from '@/lib/queryKeys';
import type { ReceivableItem } from '@/lib/services/receivables-service';
import {
  DEFAULT_PAYMENT_METHODS,
  type CreatePaymentRecordData,
} from '@/lib/types/payment';
import { formatCurrency } from '@/lib/utils';
import { logger } from '@/lib/utils/console-logger';
import { createPaymentRecordSchema } from '@/lib/validations/payment';

type FormValues = CreatePaymentRecordData;

interface ReceivablePaymentDialogProps {
  receivable: ReceivableItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReceivablePaymentDialog({
  receivable,
  open,
  onOpenChange,
  onSuccess,
}: ReceivablePaymentDialogProps) {
  const { toast } = useToast();
  const createPaymentMutation = useCreatePaymentRecord();
  const confirmPaymentMutation = useConfirmPayment();
  const queryClient = useQueryClient();

  const defaultValues = useMemo<FormValues>(
    () => ({
      paymentType: 'order_payment',
      salesOrderId: receivable?.id ?? '',
      customerId: receivable?.customerId ?? '',
      paymentMethod: 'cash',
      paymentAmount: receivable?.remainingAmount ?? 0,
      actualPaymentAmount: receivable?.remainingAmount ?? 0,
      roundingAmount: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
      receiptNumber: '',
      bankInfo: '',
    }),
    [receivable]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(createPaymentRecordSchema),
    defaultValues,
  });

  useEffect(() => {
    if (receivable) {
      form.reset({
        paymentType: 'order_payment',
        salesOrderId: receivable.id,
        customerId: receivable.customerId,
        paymentMethod: form.getValues('paymentMethod') ?? 'cash',
        paymentAmount: receivable.remainingAmount,
        actualPaymentAmount: receivable.remainingAmount,
        roundingAmount: 0,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        receiptNumber: '',
        bankInfo: '',
      });
    } else {
      form.reset(defaultValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivable, form.reset]);

  const paymentMethod = form.watch('paymentMethod');
  const paymentAmountValue = form.watch('paymentAmount');
  const actualPaymentAmountValue = form.watch('actualPaymentAmount');

  useEffect(() => {
    if (
      typeof paymentAmountValue === 'number' &&
      !Number.isNaN(paymentAmountValue) &&
      typeof actualPaymentAmountValue === 'number' &&
      !Number.isNaN(actualPaymentAmountValue)
    ) {
      const rounding = Number(
        (paymentAmountValue - actualPaymentAmountValue).toFixed(2)
      );
      if (rounding !== form.getValues('roundingAmount')) {
        form.setValue('roundingAmount', rounding, { shouldDirty: true });
      }
    } else if (form.getValues('roundingAmount') !== 0) {
      form.setValue('roundingAmount', 0, { shouldDirty: true });
    }
  }, [paymentAmountValue, actualPaymentAmountValue, form]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset(defaultValues);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (values: FormValues) => {
    if (!receivable) {
      toast({
        title: '错误',
        description: '应收账款信息不存在',
        variant: 'destructive',
      });
      return;
    }

    // ✅ 修复: 添加详细的验证逻辑和错误提示
    if (!values.paymentAmount || values.paymentAmount <= 0) {
      form.setError('paymentAmount', {
        type: 'manual',
        message: '收款金额必须大于0',
      });
      return;
    }

    if (values.paymentAmount > receivable.remainingAmount) {
      form.setError('paymentAmount', {
        type: 'manual',
        message: `收款金额不能超过待收金额 ¥${receivable.remainingAmount.toFixed(2)}`,
      });
      return;
    }

    const payload: CreatePaymentRecordData = {
      ...values,
      paymentType: 'order_payment',
      salesOrderId: receivable.id,
      customerId: receivable.customerId,
      paymentAmount: Number(values.paymentAmount),
      actualPaymentAmount: Number(values.actualPaymentAmount ?? 0),
      roundingAmount: Number(values.roundingAmount ?? 0),
      remarks: values.remarks?.trim() || undefined,
      receiptNumber: values.receiptNumber?.trim() || undefined,
      bankInfo:
        values.paymentMethod === 'bank_transfer'
          ? values.bankInfo?.trim() || ''
          : values.bankInfo?.trim() || undefined,
    };

    try {
      // ✅ 修复: 添加详细的日志记录
      logger.info(
        'finance:receivable-payment-dialog',
        '开始创建收款记录',
        {
          orderId: receivable.id,
          customerId: receivable.customerId,
          paymentAmount: payload.paymentAmount,
          actualPaymentAmount: payload.actualPaymentAmount,
        }
      );

      const paymentRecord = await createPaymentMutation.mutateAsync(payload);
      logger.info(
        'finance:receivable-payment-dialog',
        '收款记录已创建',
        { paymentRecord }
      );

      await confirmPaymentMutation.mutateAsync({ id: paymentRecord.id });
      logger.info(
        'finance:receivable-payment-dialog',
        '收款记录已确认',
        { paymentRecordId: paymentRecord.id }
      );

      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.stats(),
      });
      toast({
        title: '收款记录已创建',
        description: `成功收款 ${formatCurrency(payload.actualPaymentAmount)}`,
        variant: 'success',
      });
      handleClose(false);
      onSuccess?.();
    } catch (error) {
      logger.error(
        'finance:receivable-payment-dialog',
        '收款失败',
        error,
        {
          orderId: receivable?.id,
          customerId: receivable?.customerId,
        }
      );
      toast({
        title: '收款失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>登记收款</DialogTitle>
        </DialogHeader>
        {receivable ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] p-4 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-[hsl(var(--color-text-primary))]">
                    订单编号：{receivable.orderNumber}
                  </div>
                  <div className="text-[hsl(var(--color-text-secondary))]">
                    客户：{receivable.customerName}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-[hsl(var(--color-text-secondary))]">
                    订单金额
                  </div>
                  <div className="text-lg font-semibold text-[hsl(var(--color-text-primary))]">
                    {formatCurrency(receivable.totalAmount)}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-[hsl(var(--color-text-tertiary))]">
                    已收金额
                  </div>
                  <div className="font-medium text-[hsl(var(--color-success))]">
                    {formatCurrency(receivable.paidAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-[hsl(var(--color-text-tertiary))]">
                    待收金额
                  </div>
                  <div className="font-medium text-[hsl(var(--color-warning))]">
                    {formatCurrency(receivable.remainingAmount)}
                  </div>
                </div>
                <div>
                  <div className="text-[hsl(var(--color-text-tertiary))]">
                    最后收款日期
                  </div>
                  <div className="font-medium">
                    {receivable.lastPaymentDate || '—'}
                  </div>
                </div>
              </div>
            </div>

            <Form {...form}>
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit(handleSubmit)}
              >
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>收款方式</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择收款方式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEFAULT_PAYMENT_METHODS.filter(
                            method => method.isActive
                          ).map(method => (
                            <SelectItem
                              key={method.method}
                              value={method.method}
                            >
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>收款金额</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0.01}
                          value={field.value === undefined ? '' : field.value}
                          onChange={event => {
                            const value = event.target.value;
                            field.onChange(
                              value === '' ? undefined : Number(value)
                            );
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actualPaymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>实际收款金额</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={field.value === undefined ? '' : field.value}
                          onChange={event => {
                            const value = event.target.value;
                            field.onChange(
                              value === '' ? undefined : Number(value)
                            );
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        与客户实际到账金额，可低于应收金额用于抹零。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="roundingAmount"
                  render={({ field }) => {
                    const displayValue =
                      typeof field.value === 'number' &&
                      !Number.isNaN(field.value)
                        ? field.value.toFixed(2)
                        : '0.00';

                    return (
                      <FormItem>
                        <FormLabel>抹零金额</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            readOnly
                            name={field.name}
                            ref={field.ref}
                            value={displayValue}
                            className="bg-muted"
                          />
                        </FormControl>
                        <FormDescription>
                          系统根据差额自动计算，正值表示抹零减免，负值表示多收。
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>收款日期</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {paymentMethod === 'bank_transfer' && (
                  <FormField
                    control={form.control}
                    name="bankInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>银行信息</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="请输入银行账号或相关信息"
                            value={field.value ?? ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>收据号（可选）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="请输入收据编号"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="添加收款说明或备注"
                          value={field.value ?? ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleClose(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending
                    }
                  >
                    {createPaymentMutation.isPending ||
                    confirmPaymentMutation.isPending
                      ? '提交中...'
                      : '确认收款'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

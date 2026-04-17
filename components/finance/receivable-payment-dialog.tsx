'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
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
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { useConfirmPayment, useCreatePaymentRecord } from '@/lib/api/payments';
import { invalidateFinanceCaches } from '@/lib/cache/invalidation-helpers';
import { queryKeys } from '@/lib/queryKeys';
import type { ReceivableItem } from '@/lib/services/receivables-service';
import {
  DEFAULT_PAYMENT_METHODS,
  type CreatePaymentRecordData,
} from '@/lib/types/payment';
import { formatCurrency } from '@/lib/utils';
import { getFriendlyErrorMessage } from '@/lib/utils/user-friendly-error';
import {
  createPaymentRecordSchema,
  validatePaymentAmount,
} from '@/lib/validations/payment';

type FormValues = CreatePaymentRecordData;
type SubmitAction = 'pending' | 'confirm';

export interface ReceivablePaymentTarget
  extends Pick<
    ReceivableItem,
    | 'id'
    | 'orderNumber'
    | 'customerId'
    | 'customerName'
    | 'totalAmount'
    | 'paidAmount'
    | 'remainingAmount'
    | 'lastPaymentDate'
  > {}

interface ReceivablePaymentDialogProps {
  receivable: ReceivablePaymentTarget | null;
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
  const [activeAction, setActiveAction] = useState<SubmitAction | null>(null);

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
    resolver: standardSchemaResolver(createPaymentRecordSchema),
    defaultValues,
  });

  const { getValues, reset } = form;

  useEffect(() => {
    if (receivable) {
      reset({
        paymentType: 'order_payment',
        salesOrderId: receivable.id,
        customerId: receivable.customerId,
        paymentMethod: getValues('paymentMethod') ?? 'cash',
        paymentAmount: receivable.remainingAmount,
        actualPaymentAmount: receivable.remainingAmount,
        roundingAmount: 0,
        paymentDate: format(new Date(), 'yyyy-MM-dd'),
        remarks: '',
        receiptNumber: '',
        bankInfo: '',
      });
      return;
    }

    reset(defaultValues);
  }, [defaultValues, getValues, receivable, reset]);

  const _paymentMethod = form.watch('paymentMethod');
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

  const forceClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset(defaultValues);
    }
    onOpenChange(nextOpen);
  };
  const hasUnsavedChanges =
    open &&
    form.formState.isDirty &&
    !createPaymentMutation.isPending &&
    !confirmPaymentMutation.isPending;
  const { confirmLeavePage } = useUnsavedChangesGuard({
    enabled: hasUnsavedChanges,
    message: '当前收款内容尚未保存，确定要关闭吗？',
  });

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !confirmLeavePage()) {
      return;
    }

    forceClose(nextOpen);
  };

  const refreshRelatedQueries = (salesOrderId: string) => {
    invalidateFinanceCaches(queryClient);
    queryClient.invalidateQueries({
      queryKey: queryKeys.salesOrders.detail(salesOrderId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.salesOrders.all,
    });
  };

  const handleSubmit = async (values: FormValues, action: SubmitAction) => {
    if (!receivable) {
      return;
    }

    if (
      !validatePaymentAmount(values.paymentAmount, receivable.remainingAmount)
    ) {
      form.setError('paymentAmount', {
        type: 'manual',
        message: '收款金额不能超过待收金额',
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
      bankInfo: values.bankInfo?.trim() || undefined, // ✅ 移除无效的bank_transfer检查
    };

    try {
      setActiveAction(action);
      const paymentRecord = await createPaymentMutation.mutateAsync(payload);

      if (action === 'pending') {
        refreshRelatedQueries(receivable.id);
        toast({
          title: '已登记待确认收款',
          description:
            '这笔收款已经登记成功，请到“收款管理”里确认到账。',
          variant: 'success',
        });
        forceClose(false);
        onSuccess?.();
        return;
      }

      try {
        await confirmPaymentMutation.mutateAsync({ id: paymentRecord.id });
        refreshRelatedQueries(receivable.id);
        toast({
          title: '收款已确认到账',
          description: `已确认到账 ${formatCurrency(payload.actualPaymentAmount)}`,
          variant: 'success',
        });
        forceClose(false);
        onSuccess?.();
      } catch (confirmError) {
        refreshRelatedQueries(receivable.id);
        toast({
          title: '已登记待确认收款',
          description: getFriendlyErrorMessage(
            confirmError,
            '收款记录已经登记成功，但这次未能自动确认到账，请到“收款管理”里继续确认。'
          ),
          variant: 'warning',
        });
        forceClose(false);
        onSuccess?.();
      }
    } catch (error) {
      toast({
        title: action === 'pending' ? '登记失败' : '收款失败',
        description: getFriendlyErrorMessage(
          error,
          action === 'pending'
            ? '这笔待确认收款暂时登记不了，请稍后再试'
            : '这笔收款暂时保存不了，请稍后再试'
        ),
        variant: 'destructive',
      });
    } finally {
      setActiveAction(null);
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

            <div className="rounded-lg border border-dashed border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-4 py-3 text-sm text-[hsl(var(--color-text-secondary))]">
              款项已经到账时，直接点“登记并确认到账”；如果只是先录入收款记录，后续再由财务确认，请点“登记待确认收款”。
            </div>

            <Form {...form}>
              <form
                className="space-y-3"
                onSubmit={form.handleSubmit(values =>
                  handleSubmit(values, 'confirm')
                )}
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
                        这里填客户这次实际到账的金额；如果有尾差，按实际到账填写即可。
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
                          根据上面两个金额自动算出；正数表示少收结清，负数表示多收。
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

                {/* ✅ 移除无效的bank_transfer检查 - paymentMethodSchema中没有此值 */}
                {false && (
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
                          placeholder="例如：客户补款、尾款到账、现场现金收款"
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
                    disabled={
                      createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending
                    }
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending
                    }
                    onClick={() => {
                      void form.handleSubmit(values =>
                        handleSubmit(values, 'pending')
                      )();
                    }}
                  >
                    {activeAction === 'pending' &&
                    (createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending)
                      ? '登记中...'
                      : '登记待确认收款'}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending
                    }
                  >
                    {activeAction === 'confirm' &&
                    (createPaymentMutation.isPending ||
                      confirmPaymentMutation.isPending)
                      ? '处理中...'
                      : '登记并确认到账'}
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

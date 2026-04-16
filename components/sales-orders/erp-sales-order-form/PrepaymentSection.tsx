import { AlertCircle, Info } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

interface PrepaymentSectionProps {
  form: UseFormReturn<SalesOrderCreateFormData>;
  customerId?: string | null;
  orderTotal: number;
  disabled?: boolean;
}

// 格式化金额显示
const formatCurrency = (amount: number) =>
  amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// 验证冲抵金额
const validatePrepaymentAmount = (
  value: number | undefined,
  usePrepayment: boolean,
  availableBalance: number,
  orderTotal: number
): boolean => {
  if (!usePrepayment) return true;
  if (!value || value <= 0) return false;
  if (value > availableBalance) return false;
  if (value > orderTotal) return false;
  return true;
};

// 余额信息显示组件
function BalanceInfo({
  isLoading,
  error,
  availableBalance,
  orderTotal,
  maxApplicableAmount,
}: {
  isLoading: boolean;
  error: string | null;
  availableBalance: number;
  orderTotal: number;
  maxApplicableAmount: number;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="py-2">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">可用预收款余额：</span>
        <span className="font-semibold text-[hsl(var(--color-primary))]">
          ￥{formatCurrency(availableBalance)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">订单金额：</span>
        <span className="font-semibold">￥{formatCurrency(orderTotal)}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">最大可抵扣金额：</span>
        <span className="font-semibold text-green-600">
          ￥{formatCurrency(maxApplicableAmount)}
        </span>
      </div>
    </div>
  );
}

// 冲抵金额输入组件
function PrepaymentAmountInput({
  form,
  disabled,
  isLoading,
  error,
  maxApplicableAmount,
}: {
  form: UseFormReturn<SalesOrderCreateFormData>;
  disabled: boolean;
  isLoading: boolean;
  error: string | null;
  maxApplicableAmount: number;
}) {
  return (
    <FormField
      control={form.control}
      name="prepaymentAmount"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm">抵扣金额</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="text-muted-foreground absolute top-2.5 left-3 text-sm">
                ￥
              </span>
              <Input
                type="number"
                placeholder="输入抵扣金额"
                min={0}
                max={maxApplicableAmount}
                step={0.01}
                className="pl-7"
                disabled={disabled || isLoading || !!error}
                value={field.value || ''}
                onChange={e => {
                  const value = e.target.value
                    ? parseFloat(e.target.value)
                    : undefined;
                  field.onChange(value);
                }}
              />
            </div>
          </FormControl>
          <FormDescription className="text-xs">
            <div className="flex items-start gap-1">
              <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                可输入0.01 - {formatCurrency(maxApplicableAmount)}元 之间的金额
              </span>
            </div>
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

// 验证提示组件
function ValidationAlert({
  prepaymentAmount,
  availableBalance,
  orderTotal,
}: {
  prepaymentAmount: number;
  availableBalance: number;
  orderTotal: number;
}) {
  return (
    <Alert variant="destructive" className="py-2">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-xs">
        {prepaymentAmount > availableBalance
          ? `抵扣金额不能超过可用余额 ￥${formatCurrency(availableBalance)}`
          : prepaymentAmount > orderTotal
            ? `抵扣金额不能超过订单金额 ￥${formatCurrency(orderTotal)}`
            : '请输入有效的抵扣金额'}
      </AlertDescription>
    </Alert>
  );
}

// 冲抵后金额预览组件
function PaymentPreview({
  orderTotal,
  prepaymentAmount,
}: {
  orderTotal: number;
  prepaymentAmount: number;
}) {
  return (
    <div className="rounded bg-green-50 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">抵扣后应付金额：</span>
        <span className="text-lg font-bold text-green-700">
          ￥{formatCurrency(orderTotal - prepaymentAmount)}
        </span>
      </div>
    </div>
  );
}

// 预收款复选框组件
function PrepaymentCheckbox({
  form,
  disabled,
  customerId,
}: {
  form: UseFormReturn<SalesOrderCreateFormData>;
  disabled: boolean;
  customerId?: string | null;
}) {
  return (
    <FormField
      control={form.control}
      name="usePrepayment"
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-y-0 space-x-3">
          <FormControl>
            <Checkbox
              checked={field.value || false}
              onCheckedChange={checked => {
                field.onChange(checked);
                // 取消勾选时清空金额
                if (!checked) {
                  form.setValue('prepaymentAmount', undefined);
                }
              }}
              disabled={disabled || !customerId}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel className="text-sm font-medium">
              使用预收款抵扣
            </FormLabel>
            <FormDescription className="text-xs">
              {!customerId
                ? '请先选择客户'
                : '使用客户的预收款余额抵扣订单金额'}
            </FormDescription>
          </div>
        </FormItem>
      )}
    />
  );
}

// 预收款详情面板组件
function PrepaymentDetailsPanel({
  form,
  disabled,
  isLoading,
  error,
  availableBalance,
  orderTotal,
  maxApplicableAmount,
  prepaymentAmount,
  isValid,
}: {
  form: UseFormReturn<SalesOrderCreateFormData>;
  disabled: boolean;
  isLoading: boolean;
  error: string | null;
  availableBalance: number;
  orderTotal: number;
  maxApplicableAmount: number;
  prepaymentAmount?: number;
  isValid: boolean;
}) {
  return (
    <div className="ml-6 space-y-4 rounded border bg-[hsl(var(--color-primary-light))] p-4">
      {/* 余额信息 */}
      <div className="space-y-2">
        <BalanceInfo
          isLoading={isLoading}
          error={error}
          availableBalance={availableBalance}
          orderTotal={orderTotal}
          maxApplicableAmount={maxApplicableAmount}
        />
      </div>

      {/* 冲抵金额输入 */}
      <PrepaymentAmountInput
        form={form}
        disabled={disabled}
        isLoading={isLoading}
        error={error}
        maxApplicableAmount={maxApplicableAmount}
      />

      {/* 验证提示 */}
      {prepaymentAmount && !isValid && (
        <ValidationAlert
          prepaymentAmount={prepaymentAmount}
          availableBalance={availableBalance}
          orderTotal={orderTotal}
        />
      )}

      {/* 冲抵后金额预览 */}
      {prepaymentAmount && prepaymentAmount > 0 && isValid && (
        <PaymentPreview
          orderTotal={orderTotal}
          prepaymentAmount={prepaymentAmount}
        />
      )}
    </div>
  );
}

/**
 * 预收款Section组件
 * 支持客户预收款冲抵订单金额
 */
export function PrepaymentSection({
  form,
  customerId,
  orderTotal,
  disabled = false,
}: PrepaymentSectionProps) {
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usePrepayment = form.watch('usePrepayment');
  const prepaymentAmount = form.watch('prepaymentAmount');

  // 查询客户可用预收款余额
  useEffect(() => {
    if (!customerId || !usePrepayment) {
      setAvailableBalance(0);
      setError(null);
      return;
    }

    const fetchPrepaymentBalance = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/customers/${customerId}/prepayment-balance`
        );

        if (!response.ok) {
          throw new Error('获取预收款余额失败');
        }

        const data = await response.json();
        setAvailableBalance(data.data?.availableBalance || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取预收款余额失败');
        setAvailableBalance(0);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchPrepaymentBalance();
  }, [customerId, usePrepayment]);

  // 计算最大可冲抵金额
  const maxApplicableAmount = Math.min(availableBalance, orderTotal);

  // 验证当前冲抵金额
  const isValid = validatePrepaymentAmount(
    prepaymentAmount,
    usePrepayment || false,
    availableBalance,
    orderTotal
  );

  return (
    <div className="space-y-4">
      <PrepaymentCheckbox
        form={form}
        disabled={disabled}
        customerId={customerId}
      />

      {usePrepayment && customerId && (
        <PrepaymentDetailsPanel
          form={form}
          disabled={disabled}
          isLoading={isLoading}
          error={error}
          availableBalance={availableBalance}
          orderTotal={orderTotal}
          maxApplicableAmount={maxApplicableAmount}
          prepaymentAmount={prepaymentAmount}
          isValid={isValid}
        />
      )}
    </div>
  );
}

import { Save } from 'lucide-react';
import { type SubmitHandler, type UseFormReturn } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { DialogFooter } from '@/components/ui/dialog';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import {
  PAYMENT_METHODS,
  type PaymentFormData,
} from './payment-creation-dialog.config';

export interface PaymentFormProps {
  form: UseFormReturn<PaymentFormData>;
  enableRounding: boolean;
  paymentMethod: PaymentFormData['paymentMethod'];
  onRoundingToggle: (checked: boolean) => void;
  onSubmit: SubmitHandler<PaymentFormData>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function PaymentForm({
  form,
  enableRounding,
  paymentMethod,
  onRoundingToggle,
  onSubmit,
  onCancel,
  isSubmitting,
}: PaymentFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <PaymentMethodSelect form={form} />
        <PaymentAmountInput form={form} enableRounding={enableRounding} />
        <RoundingToggle checked={enableRounding} onToggle={onRoundingToggle} />
        {enableRounding && (
          <>
            <ActualAmountField form={form} />
            <RoundingAmountField form={form} />
          </>
        )}
        <PaymentDateField form={form} />
        <BankInfoField form={form} paymentMethod={paymentMethod} />
        <RemarksField form={form} />
        <FormActions onCancel={onCancel} isSubmitting={isSubmitting} />
      </form>
    </Form>
  );
}

interface FormComponentProps {
  form: UseFormReturn<PaymentFormData>;
}

function PaymentMethodSelect({ form }: FormComponentProps) {
  return (
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
  );
}

interface PaymentAmountInputProps extends FormComponentProps {
  enableRounding: boolean;
}

function PaymentAmountInput({ form, enableRounding }: PaymentAmountInputProps) {
  return (
    <FormField
      control={form.control}
      name="paymentAmount"
      render={({ field }) => (
        <FormItem>
          <FormLabel>应收金额 *</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              {...field}
              onChange={event =>
                field.onChange(parseFloat(event.target.value) || 0)
              }
              disabled={enableRounding}
              className={
                enableRounding ? 'bg-muted cursor-not-allowed opacity-60' : ''
              }
            />
          </FormControl>
          <FormDescription>
            {enableRounding
              ? '启用差额调整后，应收金额不可修改，请在"实际到账金额"中输入'
              : '输入本次收款金额（支持全额或部分收款）'}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface RoundingToggleProps {
  checked: boolean;
  onToggle: (checked: boolean) => void;
}

function RoundingToggle({ checked, onToggle }: RoundingToggleProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))]/50 p-4">
      <div className="space-y-0.5">
        <label className="text-sm font-medium">启用收款差额调整</label>
        <p className="text-xs text-[hsl(var(--color-text-tertiary))]">
          当实际收款金额与应收金额不一致时启用（如抹零、四舍五入等）
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function ActualAmountField({ form }: FormComponentProps) {
  return (
    <FormField
      control={form.control}
      name="actualPaymentAmount"
      render={({ field }) => (
        <FormItem>
          <FormLabel>实际到账金额 *</FormLabel>
          <FormControl>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={field.value}
              onChange={event =>
                field.onChange(
                  event.target.value === ''
                    ? 0
                    : parseFloat(event.target.value) || 0
                )
              }
            />
          </FormControl>
          <FormDescription>
            客户实际支付的金额（可以少于收款金额）
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function RoundingAmountField({ form }: FormComponentProps) {
  return (
    <FormField
      control={form.control}
      name="roundingAmount"
      render={({ field }) => {
        const displayValue =
          typeof field.value === 'number' && !Number.isNaN(field.value)
            ? field.value.toFixed(2)
            : '0.00';

        return (
          <FormItem>
            <FormLabel>收款差额</FormLabel>
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
              自动计算：收款金额 - 实际到账（正数=优惠/少收，负数=多收）
            </FormDescription>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

function PaymentDateField({ form }: FormComponentProps) {
  return (
    <FormField
      control={form.control}
      name="paymentDate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>收款日期时间 *</FormLabel>
          <FormControl>
            <Input type="datetime-local" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface BankInfoFieldProps extends FormComponentProps {
  paymentMethod: PaymentFormData['paymentMethod'];
}

function BankInfoField({ form, paymentMethod }: BankInfoFieldProps) {
  // ✅ 微信转账和银行收款码可选填写备注信息
  const shouldShowBankInfo =
    paymentMethod === 'wechat_transfer' ||
    paymentMethod === 'abc_qr' ||
    paymentMethod === 'icbc_qr' ||
    paymentMethod === 'ccb_qr' ||
    paymentMethod === 'cib_qr';

  if (!shouldShowBankInfo) {
    return null;
  }

  return (
    <FormField
      control={form.control}
      name="bankInfo"
      render={({ field }) => (
        <FormItem>
          <FormLabel>收款账户信息（可选）</FormLabel>
          <FormControl>
            <Input placeholder="收款账户、交易流水号等信息" {...field} />
          </FormControl>
          <FormDescription>记录收款账户或交易流水号等信息</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function RemarksField({ form }: FormComponentProps) {
  return (
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
  );
}

interface FormActionsProps {
  onCancel: () => void;
  isSubmitting: boolean;
}

function FormActions({ onCancel, isSubmitting }: FormActionsProps) {
  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        取消
      </Button>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-primary))]/90"
      >
        <Save className="mr-2 h-4 w-4" />
        {isSubmitting ? '创建中...' : '创建收款记录'}
      </Button>
    </DialogFooter>
  );
}

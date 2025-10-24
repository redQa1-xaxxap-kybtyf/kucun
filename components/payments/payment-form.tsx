// 收款记录表单组件
// 使用React Hook Form + Zod实现收款记录的创建和编辑表单

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  Building2,
  CalendarIcon,
  Check,
  DollarSign,
  Loader2,
  Receipt,
  X,
} from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';

import { ContentLoading } from '@/components/common/loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { paymentUtils } from '@/lib/api/payments';
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_STATUSES,
  type PaymentMethod,
  type PaymentRecordDetail,
} from '@/lib/types/payment';
import { cn } from '@/lib/utils';
import {
  createPaymentRecordSchema,
  PAYMENT_FORM_FIELDS,
  updatePaymentRecordSchema,
  type CreatePaymentRecordInput,
  type UpdatePaymentRecordInput,
} from '@/lib/validations/payment';
import { logger } from '@/lib/utils/console-logger';

export interface PaymentFormProps {
  initialData?: PaymentRecordDetail;
  salesOrderId?: string;
  customerId?: string;
  onSubmit: (
    data: CreatePaymentRecordInput | UpdatePaymentRecordInput
  ) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
  className?: string;
}

const PaymentForm = React.forwardRef<HTMLDivElement, PaymentFormProps>(
  (
    {
      initialData,
      salesOrderId,
      customerId,
      onSubmit,
      onCancel,
      isLoading = false,
      className,
      ...props
    },
    ref
  ) => {
    const isEditing = !!initialData;
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // 表单配置
    const form = useForm<CreatePaymentRecordInput | UpdatePaymentRecordInput>({
      resolver: zodResolver(
        isEditing ? updatePaymentRecordSchema : createPaymentRecordSchema
      ),
      defaultValues: isEditing
        ? {
            paymentMethod: initialData.paymentMethod,
            paymentAmount: initialData.paymentAmount,
            actualPaymentAmount:
              'actualPaymentAmount' in initialData &&
              typeof initialData.actualPaymentAmount === 'number'
                ? initialData.actualPaymentAmount
                : initialData.paymentAmount,
            roundingAmount:
              'roundingAmount' in initialData &&
              typeof initialData.roundingAmount === 'number'
                ? initialData.roundingAmount
                : 0,
            paymentDate:
              typeof initialData.paymentDate === 'string'
                ? initialData.paymentDate.split('T')[0]
                : initialData.paymentDate.toISOString().split('T')[0],
            status: initialData.status,
            remarks: initialData.remarks || '',
            receiptNumber: initialData.receiptNumber || '',
            bankInfo: initialData.bankInfo || '',
          }
        : {
            salesOrderId: salesOrderId || '',
            customerId: customerId || '',
            paymentMethod: 'cash' as PaymentMethod,
            paymentAmount: 0,
            actualPaymentAmount: 0,
            roundingAmount: 0,
            paymentDate: format(new Date(), 'yyyy-MM-dd'),
            remarks: '',
            receiptNumber: '',
            bankInfo: '',
          },
    });

    // 监听收款方式变化
    const watchedPaymentMethod = form.watch('paymentMethod');
    const watchedPaymentAmount = form.watch('paymentAmount');
    const watchedActualAmount = form.watch('actualPaymentAmount');

    React.useEffect(() => {
      if (
        typeof watchedPaymentAmount === 'number' &&
        !Number.isNaN(watchedPaymentAmount) &&
        typeof watchedActualAmount === 'number' &&
        !Number.isNaN(watchedActualAmount)
      ) {
        const rounding = Number(
          (watchedPaymentAmount - watchedActualAmount).toFixed(2)
        );
        if (rounding !== form.getValues('roundingAmount')) {
          form.setValue('roundingAmount', rounding, { shouldDirty: true });
        }
      } else if (form.getValues('roundingAmount') !== 0) {
        form.setValue('roundingAmount', 0, { shouldDirty: true });
      }
    }, [form, watchedActualAmount, watchedPaymentAmount]);

    // 处理表单提交
    const handleSubmit = async (
      data: CreatePaymentRecordInput | UpdatePaymentRecordInput
    ) => {
      try {
        setIsSubmitting(true);
        await onSubmit(data);
      } catch (error) {
        logger.error('finance:payment-form', '提交表单失败', error);
      } finally {
        setIsSubmitting(false);
      }
    };

    // 处理取消
    const handleCancel = () => {
      form.reset();
      onCancel?.();
    };

    if (isLoading) {
      return <PaymentFormSkeleton />;
    }

    return (
      <Card className={cn('w-full', className)} ref={ref} {...props}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="h-5 w-5" />
            <span>{isEditing ? '编辑收款记录' : '创建收款记录'}</span>
          </CardTitle>
          <CardDescription>
            {isEditing ? '修改收款记录信息' : '填写收款记录详细信息'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              {/* 基础信息 */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* 销售订单（仅创建时显示） */}
                {!isEditing && (
                  <FormField
                    control={form.control}
                    name="salesOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {PAYMENT_FORM_FIELDS.salesOrderId.label}
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  PAYMENT_FORM_FIELDS.salesOrderId.placeholder
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {/* 这里应该从API获取销售订单列表 */}
                              <SelectItem value="sample-order-1">
                                SO-2024-001
                              </SelectItem>
                              <SelectItem value="sample-order-2">
                                SO-2024-002
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 客户（仅创建时显示） */}
                {!isEditing && (
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {PAYMENT_FORM_FIELDS.customerId.label}
                        </FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  PAYMENT_FORM_FIELDS.customerId.placeholder
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {/* 这里应该从API获取客户列表 */}
                              <SelectItem value="sample-customer-1">
                                张三建材
                              </SelectItem>
                              <SelectItem value="sample-customer-2">
                                李四装饰
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 收款方式 */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {PAYMENT_FORM_FIELDS.paymentMethod.label}
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                PAYMENT_FORM_FIELDS.paymentMethod.placeholder
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {DEFAULT_PAYMENT_METHODS.filter(
                              method => method.isActive
                            ).map(method => (
                              <SelectItem
                                key={method.method}
                                value={method.method}
                              >
                                <div className="flex items-center space-x-2">
                                  <span>
                                    {paymentUtils.getPaymentMethodIcon(
                                      method.method
                                    )}
                                  </span>
                                  <span>{method.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
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
                      <FormLabel>
                        {PAYMENT_FORM_FIELDS.paymentAmount.label}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={
                              PAYMENT_FORM_FIELDS.paymentAmount.placeholder
                            }
                            className="pl-10"
                            {...field}
                            onChange={e =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 实际收款金额 */}
                <FormField
                  control={form.control}
                  name="actualPaymentAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {PAYMENT_FORM_FIELDS.actualPaymentAmount.label}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={
                              PAYMENT_FORM_FIELDS.actualPaymentAmount
                                .placeholder
                            }
                            className="pl-10"
                            value={field.value === undefined ? '' : field.value}
                            onChange={e =>
                              field.onChange(
                                e.target.value === ''
                                  ? undefined
                                  : parseFloat(e.target.value) || 0
                              )
                            }
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        实际到账金额，可低于收款金额以记录抹零
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 抹零金额 */}
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
                        <FormLabel>
                          {PAYMENT_FORM_FIELDS.roundingAmount.label}
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              readOnly
                              name={field.name}
                              ref={field.ref}
                              value={displayValue}
                              className="bg-muted pl-10"
                            />
                            <DollarSign className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                          </div>
                        </FormControl>
                        <FormDescription>
                          系统自动计算的差额，正值表示抹零减免，负值表示多收
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                {/* 收款日期 */}
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {PAYMENT_FORM_FIELDS.paymentDate.label}
                      </FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(new Date(field.value), 'PPP', {
                                  locale: zhCN,
                                })
                              ) : (
                                <span>
                                  {PAYMENT_FORM_FIELDS.paymentDate.placeholder}
                                </span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={
                                field.value ? new Date(field.value) : undefined
                              }
                              onSelect={date =>
                                field.onChange(
                                  date ? format(date, 'yyyy-MM-dd') : ''
                                )
                              }
                              disabled={date => date > new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 收据号 */}
                <FormField
                  control={form.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {PAYMENT_FORM_FIELDS.receiptNumber.label}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Receipt className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
                          <Input
                            placeholder={
                              PAYMENT_FORM_FIELDS.receiptNumber.placeholder
                            }
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 状态（仅编辑时显示） */}
                {isEditing && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>收款状态</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="请选择收款状态" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEFAULT_PAYMENT_STATUSES.filter(
                                status => status.isActive
                              ).map(status => (
                                <SelectItem
                                  key={status.status}
                                  value={status.status}
                                >
                                  <div className="flex items-center space-x-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-${status.color}-600`}
                                    >
                                      {status.label}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* 银行信息（银行转账时显示） */}
              {watchedPaymentMethod === 'bank_transfer' && (
                <FormField
                  control={form.control}
                  name="bankInfo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center space-x-2">
                        <Building2 className="h-4 w-4" />
                        <span>{PAYMENT_FORM_FIELDS.bankInfo.label}</span>
                        <Badge variant="destructive" className="text-xs">
                          必填
                        </Badge>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={PAYMENT_FORM_FIELDS.bankInfo.placeholder}
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        请填写银行名称、账号、户名等转账相关信息
                      </FormDescription>
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
                    <FormLabel>{PAYMENT_FORM_FIELDS.remarks.label}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={PAYMENT_FORM_FIELDS.remarks.placeholder}
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 操作按钮 */}
              <div className="flex items-center justify-end space-x-4 border-t pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  取消
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  {isEditing ? '更新' : '创建'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    );
  }
);

PaymentForm.displayName = 'PaymentForm';

// 加载骨架屏
function PaymentFormSkeleton() {
  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <ContentLoading text="加载表单..." />
      </CardContent>
    </Card>
  );
}

export { PaymentForm };

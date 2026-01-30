'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ChineseYuan } from '@/components/icons/chinese-yuan';
import { Button } from '@/components/ui/button';
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
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

import type { PaymentOutRecord } from './page-client';

const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(mod => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="h-[296px] w-[280px] animate-pulse rounded-lg bg-slate-50" />
    ),
  }
);

// 编辑付款记录表单Schema
const editPaymentOutSchema = z.object({
  paymentMethod: z.enum(
    ['cash', 'bank_transfer', 'alipay', 'wechat', 'check', 'other'],
    {
      message: '请选择付款方式',
    }
  ),
  paymentAmount: z.number().min(0.01, { error: '付款金额必须大于0' }),
  paymentDate: z.string().min(1, { error: '请选择付款日期' }),
  voucherNumber: z.string().optional(),
  bankInfo: z.string().optional(),
  remarks: z.string().optional(),
});

type EditPaymentOutFormData = z.infer<typeof editPaymentOutSchema>;

/**
 * 应付款信息侧边栏组件
 */
function PayableInfoSidebar({
  payableRecord,
}: {
  payableRecord: NonNullable<PaymentOutRecord['payableRecord']>;
}) {
  return (
    <Card>
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle className="flex items-center gap-2">
          <ChineseYuan className="h-5 w-5" />
          关联应付款信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div>
          <p className="text-muted-foreground text-sm">应付款单号</p>
          <p className="font-medium">{payableRecord.payableNumber}</p>
        </div>
        <Separator />
        <div>
          <p className="text-muted-foreground text-sm">供应商</p>
          <p className="font-medium">{payableRecord.supplier.name}</p>
          {payableRecord.supplier.phone && (
            <p className="text-muted-foreground text-sm">
              {payableRecord.supplier.phone}
            </p>
          )}
        </div>
        <Separator />
        <div>
          <p className="text-muted-foreground text-sm">应付金额</p>
          <p className="text-lg font-semibold">
            {formatCurrency(payableRecord.payableAmount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">已付金额</p>
          <p className="font-medium text-[hsl(var(--color-success))]">
            {formatCurrency(payableRecord.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-sm">剩余应付</p>
          <p className="text-lg font-semibold text-[hsl(var(--color-warning))]">
            {formatCurrency(payableRecord.remainingAmount)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EditPaymentOutFormSection({
  initialPayment,
}: {
  initialPayment: PaymentOutRecord;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<EditPaymentOutFormData>({
    resolver: standardSchemaResolver(editPaymentOutSchema),
    defaultValues: {
      paymentMethod: initialPayment.paymentMethod as any,
      paymentAmount: initialPayment.paymentAmount,
      paymentDate: format(new Date(initialPayment.paymentDate), 'yyyy-MM-dd'),
      voucherNumber: initialPayment.voucherNumber || '',
      bankInfo: initialPayment.bankInfo || '',
      remarks: initialPayment.remarks || '',
    },
  });

  const watchedPaymentMethod = form.watch('paymentMethod');

  const updateMutation = useMutation({
    mutationFn: async (data: EditPaymentOutFormData) => {
      const response = await fetch(
        `/api/finance/payments-out/${initialPayment.id}`,
        getCsrfTokenHeader({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...data,
            idempotencyKey: crypto.randomUUID(),
          }),
        })
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新付款记录失败');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: '更新成功',
        description: '付款记录已更新',
        variant: 'success',
      });
      router.push(`/finance/payments-out/${initialPayment.id}`);
      router.refresh();
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: EditPaymentOutFormData) => {
    // 验证付款金额不超过剩余应付金额（如果是关联应付款）
    if (initialPayment.payableRecord) {
      // 计算最大允许金额：剩余应付 + 原付款金额
      const maxAmount =
        initialPayment.payableRecord.remainingAmount +
        initialPayment.paymentAmount;

      if (data.paymentAmount > maxAmount) {
        toast({
          title: '验证失败',
          description: `付款金额不能超过应付余额 ${formatCurrency(maxAmount)}`,
          variant: 'destructive',
        });
        return;
      }
    }

    updateMutation.mutate(data);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* 主表单区域 */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
            <CardTitle>付款信息</CardTitle>
            <CardDescription>编辑付款详细信息</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* 供应商信息（只读） */}
                <div className="bg-muted rounded-md p-4">
                  <p className="text-muted-foreground text-sm font-medium">
                    供应商
                  </p>
                  <p className="text-lg font-semibold">
                    {initialPayment.supplier.name}
                  </p>
                </div>

                <Separator />

                {/* 付款方式 */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款方式</FormLabel>
                      <FormControl>
                        <select
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
                          className="border-input bg-background ring-offset-background focus:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="cash">现金</option>
                          <option value="bank_transfer">银行转账</option>
                          <option value="alipay">支付宝</option>
                          <option value="wechat">微信</option>
                          <option value="check">支票</option>
                          <option value="other">其他</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 付款金额 */}
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
                          placeholder="输入付款金额"
                          {...field}
                          onChange={e =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>请输入实际付款金额</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 付款日期 */}
                <FormField
                  control={form.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>付款日期</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={'outline'}
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
                                <span>选择日期</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto p-0"
                          align="start"
                        >
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 付款凭证号 */}
                <FormField
                  control={form.control}
                  name="voucherNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>付款凭证号（可选）</FormLabel>
                      <FormControl>
                        <Input placeholder="输入付款凭证号" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 银行信息 - 仅在银行转账时显示 */}
                {watchedPaymentMethod === 'bank_transfer' && (
                  <FormField
                    control={form.control}
                    name="bankInfo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>银行信息</FormLabel>
                        <FormControl>
                          <Textarea placeholder="输入银行账户信息" {...field} />
                        </FormControl>
                        <FormDescription>
                          包括银行名称、账号等信息
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
                      <FormLabel>备注（可选）</FormLabel>
                      <FormControl>
                        <Textarea placeholder="输入备注信息" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 提交按钮 */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    取消
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateMutation.isPending ? '保存中...' : '保存修改'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* 侧边栏 - 应付款信息 */}
      {initialPayment.payableRecord && (
        <div className="lg:col-span-1">
          <PayableInfoSidebar payableRecord={initialPayment.payableRecord} />
        </div>
      )}
    </div>
  );
}

/**
 * 创建收款记录页面
 * 支持从销售订单创建收款记录，包含客户信息和订单信息
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Package, Receipt, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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

// 创建收款记录表单Schema
const createPaymentSchema = z
  .object({
    salesOrderId: z.string().min(1, { error: '请选择销售订单' }),
    customerId: z.string().min(1, { error: '请选择客户' }),
    paymentMethod: z.enum(
      ['cash', 'bank_transfer', 'alipay', 'wechat', 'check', 'other'],
      {
        message: '请选择收款方式',
      }
    ),
    paymentAmount: z.number().min(0.01, { error: '收款金额必须大于0' }),
    actualPaymentAmount: z.number().min(0, { error: '实际收款金额不能为负' }),
    roundingAmount: z
      .number()
      .min(-9999999, { error: '抹零金额不能低于 -9,999,999' })
      .max(9999999, { error: '抹零金额不能超过 9,999,999' }),
    paymentDate: z.string().min(1, { error: '请选择收款日期' }),
    bankInfo: z.string().optional(),
    remarks: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const expected = Number(
      (value.actualPaymentAmount + value.roundingAmount).toFixed(2)
    );
    const recorded = Number(value.paymentAmount.toFixed(2));
    if (Math.abs(expected - recorded) >= 0.01) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actualPaymentAmount'],
        message: '收款金额应等于实际收款金额与抹零金额之和',
      });
    }
  });

type CreatePaymentFormData = z.infer<typeof createPaymentSchema>;

interface SalesOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
}

/**
 * 创建收款记录页面组件
 */
export default function CreatePaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreatePaymentFormData>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      salesOrderId: orderId || '',
      customerId: '',
      paymentMethod: 'cash',
      paymentAmount: 0,
      actualPaymentAmount: 0,
      roundingAmount: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      bankInfo: '',
      remarks: '',
    },
  });

  // 监听表单字段变化
  const watchedOrderId = form.watch('salesOrderId');
  const watchedPaymentMethod = form.watch('paymentMethod');
  const watchedPaymentAmount = form.watch('paymentAmount');
  const watchedActualAmount = form.watch('actualPaymentAmount');

  // 获取销售订单信息
  const { data: orderData } = useQuery({
    queryKey: queryKeys.salesOrders.detail(watchedOrderId || ''),
    queryFn: async () => {
      if (!watchedOrderId) {
        return null;
      }
      const response = await fetch(`/api/sales-orders/${watchedOrderId}`);
      if (!response.ok) {
        throw new Error('获取订单信息失败');
      }
      return response.json();
    },
    enabled: !!watchedOrderId,
  });

  const salesOrder: SalesOrder | null = orderData?.data || null;

  // 获取可用的销售订单列表
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: queryKeys.salesOrders.list({ status: 'confirmed,shipped' }),
    queryFn: async () => {
      const response = await fetch(
        '/api/sales-orders?status=confirmed,shipped&hasUnpaidAmount=true'
      );
      if (!response.ok) {
        throw new Error('获取订单列表失败');
      }
      return response.json();
    },
  });

  const availableOrders: SalesOrder[] = ordersData?.data?.orders || [];

  useEffect(() => {
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
  }, [watchedPaymentAmount, watchedActualAmount, form]);

  // 创建收款记录
  const createMutation = useMutation({
    mutationFn: async (data: CreatePaymentFormData) => {
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
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: '收款记录创建成功',
        variant: 'success',
      });

      // ✅ 关键修复：失效应收款缓存
      // 因为收款会影响应收款列表数据
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
      });

      // ✅ 失效收款记录缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.payments.all,
      });

      // ✅ 失效销售订单缓存
      // 因为收款会更新订单的 paidAmount 字段
      queryClient.invalidateQueries({
        queryKey: queryKeys.salesOrders.all,
      });

      // ✅ 失效财务统计缓存
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.stats(),
      });

      router.push(`/finance/payments/${data.data.id}`);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });

  // 当通过URL参数指定订单时，自动设置客户ID和收款金额
  useEffect(() => {
    if (orderId && salesOrder) {
      form.setValue('customerId', salesOrder.customer.id);
      form.setValue('paymentAmount', salesOrder.remainingAmount);
      form.setValue('actualPaymentAmount', salesOrder.remainingAmount);
      form.setValue('roundingAmount', 0);
    }
  }, [orderId, salesOrder, form]);

  // 处理订单选择
  const handleOrderSelect = (orderId: string) => {
    const order = availableOrders.find(o => o.id === orderId);
    if (order) {
      form.setValue('customerId', order.customer.id);
      form.setValue('paymentAmount', order.remainingAmount);
      form.setValue('actualPaymentAmount', order.remainingAmount);
      form.setValue('roundingAmount', 0);
    }
  };

  // 提交表单
  const onSubmit = (data: CreatePaymentFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-[var(--shadow-medium)]">
          <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-success))] shadow-lg shadow-green-600/30">
                  <Receipt className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    创建收款记录
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    填写收款记录详细信息，记录客户付款
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
              >
                <Link href="/finance/payments">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 主要表单 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  收款信息
                </CardTitle>
                <CardDescription>请填写收款记录的详细信息</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    {/* 销售订单选择 */}
                    <FormField
                      control={form.control}
                      name="salesOrderId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>销售订单 *</FormLabel>
                          {orderId ? (
                            // 如果URL中指定了订单ID，显示为只读
                            <div className="rounded-md border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-3 py-2">
                              <p className="text-sm font-medium text-[hsl(var(--color-text-primary))]">
                                {salesOrder?.orderNumber || '加载中...'}
                              </p>
                              <p className="mt-1 text-xs text-[hsl(var(--color-text-tertiary))]">
                                此收款记录关联到指定订单，无法修改
                              </p>
                            </div>
                          ) : (
                            // 如果没有指定订单，允许选择
                            <Select
                              value={field.value}
                              onValueChange={value => {
                                field.onChange(value);
                                handleOrderSelect(value);
                              }}
                              disabled={ordersLoading}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择销售订单" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {availableOrders.map(order => (
                                  <SelectItem key={order.id} value={order.id}>
                                    <div className="flex w-full items-center justify-between">
                                      <span>{order.orderNumber}</span>
                                      <span className="ml-2 text-sm text-[hsl(var(--color-text-tertiary))]">
                                        {order.customer.name} - 待收：
                                        {formatCurrency(order.remainingAmount)}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {!orderId && (
                            <FormDescription>
                              选择需要收款的销售订单
                            </FormDescription>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 收款方式 */}
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>收款方式 *</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择收款方式" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">现金</SelectItem>
                              <SelectItem value="bank_transfer">
                                银行转账
                              </SelectItem>
                              <SelectItem value="alipay">支付宝</SelectItem>
                              <SelectItem value="wechat">微信支付</SelectItem>
                              <SelectItem value="check">支票</SelectItem>
                              <SelectItem value="other">其他</SelectItem>
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
                          <FormDescription>
                            记入订单的金额，将用于冲抵应收款
                          </FormDescription>
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
                          <FormLabel>实际收款金额 *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={field.value}
                              onChange={e =>
                                field.onChange(
                                  e.target.value === ''
                                    ? 0
                                    : parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            与客户实际到账的金额，可小于收款金额以实现抹零
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
                              自动计算的差额，正值表示抹零减免，负值表示多收
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
                          <FormLabel>收款日期 *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* 银行信息 */}
                    {(watchedPaymentMethod === 'bank_transfer' ||
                      watchedPaymentMethod === 'check') && (
                      <FormField
                        control={form.control}
                        name="bankInfo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>银行信息</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="银行名称、账号等信息"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              银行转账或支票的相关信息
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

                    {/* 提交按钮 */}
                    <div className="flex gap-4">
                      <Button
                        type="submit"
                        disabled={createMutation.isPending}
                        size="lg"
                        className="h-11 flex-1 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {createMutation.isPending
                          ? '创建中...'
                          : '创建收款记录'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        asChild
                        className="h-11 shadow-[var(--shadow-light)] transition-all hover:scale-105 hover:shadow-[var(--shadow-medium)]"
                      >
                        <Link href="/finance/payments">取消</Link>
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏信息 */}
          <div className="space-y-4">
            {/* 订单信息 */}
            {salesOrder && (
              <Card>
                <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    订单信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单号
                    </label>
                    <p className="text-sm font-medium">
                      {salesOrder.orderNumber}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      订单金额
                    </label>
                    <p className="text-lg font-bold">
                      {formatCurrency(salesOrder.totalAmount)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      已收金额
                    </label>
                    <p className="text-sm text-[hsl(var(--color-success))]">
                      {formatCurrency(salesOrder.paidAmount)}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      待收金额
                    </label>
                    <p className="text-lg font-bold text-[hsl(var(--color-warning))]">
                      {formatCurrency(salesOrder.remainingAmount)}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <label className="text-sm font-medium text-[hsl(var(--color-text-tertiary))]">
                      客户信息
                    </label>
                    <div className="mt-1 space-y-1">
                      <p className="text-sm font-medium">
                        {salesOrder.customer.name}
                      </p>
                      {salesOrder.customer.phone && (
                        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                          电话：{salesOrder.customer.phone}
                        </p>
                      )}
                      {salesOrder.customer.email && (
                        <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                          邮箱：{salesOrder.customer.email}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 收款提示 */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
                <CardTitle>收款提示</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6 text-sm">
                <div className="flex items-start gap-2">
                  <div className="bg-[hsl(var(--color-primary-light))]0 mt-2 h-2 w-2 shrink-0 rounded-full" />
                  <p>请确认收款金额与实际到账金额一致</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-[hsl(var(--color-primary-light))]0 mt-2 h-2 w-2 shrink-0 rounded-full" />
                  <p>建议保留收款凭证并填写收据号码</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="bg-[hsl(var(--color-primary-light))]0 mt-2 h-2 w-2 shrink-0 rounded-full" />
                  <p>收款记录创建后可在列表中查看和管理</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

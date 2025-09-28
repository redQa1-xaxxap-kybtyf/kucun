/**
 * 创建收款记录页面
 * 支持从销售订单创建收款记录，包含客户信息和订单信息
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Package, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { formatCurrency } from '@/lib/utils';

// 创建收款记录表单Schema
const createPaymentSchema = z.object({
  salesOrderId: z.string().min(1, '请选择销售订单'),
  customerId: z.string().min(1, '请选择客户'),
  paymentMethod: z.enum(
    ['cash', 'bank_transfer', 'alipay', 'wechat', 'check', 'other'],
    {
      required_error: '请选择收款方式',
    }
  ),
  paymentAmount: z.number().min(0.01, '收款金额必须大于0'),
  paymentDate: z.string().min(1, '请选择收款日期'),
  receiptNumber: z.string().optional(),
  bankInfo: z.string().optional(),
  remarks: z.string().optional(),
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

  // 表单配置
  const form = useForm<CreatePaymentFormData>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      salesOrderId: orderId || '',
      customerId: '',
      paymentMethod: 'cash',
      paymentAmount: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      receiptNumber: '',
      bankInfo: '',
      remarks: '',
    },
  });

  // 监听表单字段变化
  const watchedOrderId = form.watch('salesOrderId');
  const watchedPaymentMethod = form.watch('paymentMethod');

  // 获取销售订单信息
  const { data: orderData, isLoading: _orderLoading } = useQuery({
    queryKey: ['salesOrder', watchedOrderId],
    queryFn: async () => {
      if (!watchedOrderId) return null;
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
    queryKey: ['salesOrders', 'unpaid'],
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
      toast.success('收款记录创建成功');
      router.push(`/finance/payments/${data.data.id}`);
    },
    onError: error => {
      toast.error((error as Error).message);
    },
  });

  // 处理订单选择
  const handleOrderSelect = (orderId: string) => {
    const order = availableOrders.find(o => o.id === orderId);
    if (order) {
      form.setValue('customerId', order.customer.id);
      form.setValue('paymentAmount', order.remainingAmount);
    }
  };

  // 提交表单
  const onSubmit = (data: CreatePaymentFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/payments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">创建收款记录</h1>
          <p className="text-gray-600">填写收款记录详细信息</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 主要表单 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                收款信息
              </CardTitle>
              <CardDescription>请填写收款记录的详细信息</CardDescription>
            </CardHeader>
            <CardContent>
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
                                  <span className="ml-2 text-sm text-gray-500">
                                    {order.customer.name} - 待收：
                                    {formatCurrency(order.remainingAmount)}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          选择需要收款的销售订单
                        </FormDescription>
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

                  {/* 收据号码 */}
                  <FormField
                    control={form.control}
                    name="receiptNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>收据号码</FormLabel>
                        <FormControl>
                          <Input placeholder="收据或凭证号码" {...field} />
                        </FormControl>
                        <FormDescription>
                          收款凭证的编号（可选）
                        </FormDescription>
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
                      className="flex-1"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {createMutation.isPending ? '创建中...' : '创建收款记录'}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/finance/payments">取消</Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 订单信息 */}
          {salesOrder && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  订单信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">
                    订单号
                  </label>
                  <p className="text-sm font-medium">
                    {salesOrder.orderNumber}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    订单金额
                  </label>
                  <p className="text-lg font-bold">
                    {formatCurrency(salesOrder.totalAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    已收金额
                  </label>
                  <p className="text-sm text-green-600">
                    {formatCurrency(salesOrder.paidAmount)}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    待收金额
                  </label>
                  <p className="text-lg font-bold text-orange-600">
                    {formatCurrency(salesOrder.remainingAmount)}
                  </p>
                </div>

                <Separator />

                <div>
                  <label className="text-sm font-medium text-gray-500">
                    客户信息
                  </label>
                  <div className="mt-1 space-y-1">
                    <p className="text-sm font-medium">
                      {salesOrder.customer.name}
                    </p>
                    {salesOrder.customer.phone && (
                      <p className="text-sm text-gray-600">
                        电话：{salesOrder.customer.phone}
                      </p>
                    )}
                    {salesOrder.customer.email && (
                      <p className="text-sm text-gray-600">
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
            <CardHeader>
              <CardTitle>收款提示</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <p>请确认收款金额与实际到账金额一致</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <p>建议保留收款凭证并填写收据号码</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                <p>收款记录创建后可在列表中查看和管理</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

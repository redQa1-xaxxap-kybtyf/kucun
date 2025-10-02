/**
 * 创建付款记录页面
 * 支持从应付款记录创建付款记录，包含供应商信息和应付款信息
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, DollarSign, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { formatCurrency } from '@/lib/utils';

// 创建付款记录表单Schema
const createPaymentOutSchema = z.object({
  payableRecordId: z.string().optional(),
  supplierId: z.string().min(1, '请选择供应商'),
  paymentMethod: z.enum(
    ['cash', 'bank_transfer', 'alipay', 'wechat', 'check', 'other'],
    {
      required_error: '请选择付款方式',
    }
  ),
  paymentAmount: z.number().min(0.01, '付款金额必须大于0'),
  paymentDate: z.string().min(1, '请选择付款日期'),
  voucherNumber: z.string().optional(),
  bankInfo: z.string().optional(),
  remarks: z.string().optional(),
});

type CreatePaymentOutFormData = z.infer<typeof createPaymentOutSchema>;

interface PayableRecord {
  id: string;
  payableNumber: string;
  payableAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  supplier: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
  };
  createdAt: string;
}

/**
 * 应付款信息侧边栏组件
 */
function PayableInfoSidebar({
  payableRecord,
}: {
  payableRecord: PayableRecord;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          应付款信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">应付款单号</p>
          <p className="font-medium">{payableRecord.payableNumber}</p>
        </div>
        <Separator />
        <div>
          <p className="text-sm text-muted-foreground">供应商</p>
          <p className="font-medium">{payableRecord.supplier.name}</p>
          {payableRecord.supplier.phone && (
            <p className="text-sm text-muted-foreground">
              {payableRecord.supplier.phone}
            </p>
          )}
        </div>
        <Separator />
        <div>
          <p className="text-sm text-muted-foreground">应付金额</p>
          <p className="text-lg font-semibold">
            {formatCurrency(payableRecord.payableAmount)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">已付金额</p>
          <p className="font-medium text-green-600">
            {formatCurrency(payableRecord.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">剩余应付</p>
          <p className="text-lg font-semibold text-orange-600">
            {formatCurrency(payableRecord.remainingAmount)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 付款表单组件
 */
function PaymentOutFormFields({
  form,
  availablePayables,
  payablesLoading,
  payableRecord,
  watchedPaymentMethod,
  handlePayableSelect,
  onSubmit,
  router,
  isPending,
}: {
  form: ReturnType<typeof useForm<CreatePaymentOutFormData>>;
  availablePayables: PayableRecord[];
  payablesLoading: boolean;
  payableRecord: PayableRecord | null;
  watchedPaymentMethod: string;
  handlePayableSelect: (payableId: string) => void;
  onSubmit: (data: CreatePaymentOutFormData) => void;
  router: ReturnType<typeof useRouter>;
  isPending: boolean;
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 应付款记录选择 */}
        <FormField
          control={form.control}
          name="payableRecordId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>应付款记录（可选）</FormLabel>
              <Select
                value={field.value}
                onValueChange={value => {
                  field.onChange(value);
                  handlePayableSelect(value);
                }}
                disabled={payablesLoading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择应付款记录" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availablePayables.map(payable => (
                    <SelectItem key={payable.id} value={payable.id}>
                      {payable.payableNumber} - {payable.supplier.name} - 待付{' '}
                      {formatCurrency(payable.remainingAmount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                选择关联的应付款记录，或留空创建独立付款记录
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* 付款方式 */}
        <FormField
          control={form.control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>付款方式</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="cash">现金</SelectItem>
                  <SelectItem value="bank_transfer">银行转账</SelectItem>
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
                  placeholder="0.00"
                  {...field}
                  onChange={e =>
                    field.onChange(parseFloat(e.target.value) || 0)
                  }
                />
              </FormControl>
              {payableRecord && (
                <FormDescription>
                  剩余应付金额：
                  {formatCurrency(payableRecord.remainingAmount)}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 付款日期 */}
        <FormField
          control={form.control}
          name="paymentDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>付款日期</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
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
                <FormDescription>包括银行名称、账号等信息</FormDescription>
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
          <Button type="button" variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button type="submit" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" />
            {isPending ? '创建中...' : '创建付款记录'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * 获取应付款数据的Hook
 */
function usePayableData(payableId: string) {
  const { data: payableData } = useQuery({
    queryKey: ['payableRecord', payableId],
    queryFn: async () => {
      if (!payableId) return null;
      const response = await fetch(`/api/finance/payables/${payableId}`);
      if (!response.ok) {
        throw new Error('获取应付款信息失败');
      }
      return response.json();
    },
    enabled: !!payableId,
  });

  return payableData?.data || null;
}

/**
 * 获取可用应付款列表的Hook
 */
function useAvailablePayables() {
  const { data: payablesData, isLoading } = useQuery({
    queryKey: ['payableRecords', 'unpaid'],
    queryFn: async () => {
      const response = await fetch(
        '/api/finance/payables?status=pending,partial&limit=100'
      );
      if (!response.ok) {
        throw new Error('获取应付款列表失败');
      }
      return response.json();
    },
  });

  return {
    availablePayables: (payablesData?.data || []) as PayableRecord[],
    isLoading,
  };
}

/**
 * 创建付款记录的Hook
 */
function useCreatePaymentOut() {
  const router = useRouter();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreatePaymentOutFormData) => {
      const response = await fetch('/api/finance/payments-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建付款记录失败');
      }

      return response.json();
    },
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: '付款记录创建成功',
        variant: 'success',
      });
      router.push(`/finance/payments-out/${data.data.id}`);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: (error as Error).message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * 创建付款记录页面组件
 */
export default function CreatePaymentOutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payableId = searchParams.get('payableId');
  const { toast } = useToast();

  // 表单配置
  const form = useForm<CreatePaymentOutFormData>({
    resolver: zodResolver(createPaymentOutSchema),
    defaultValues: {
      payableRecordId: payableId || '',
      supplierId: '',
      paymentMethod: 'bank_transfer',
      paymentAmount: 0,
      paymentDate: format(new Date(), 'yyyy-MM-dd'),
      voucherNumber: '',
      bankInfo: '',
      remarks: '',
    },
  });

  const watchedPayableId = form.watch('payableRecordId');
  const watchedPaymentMethod = form.watch('paymentMethod');

  // 获取数据
  const payableRecord = usePayableData(watchedPayableId || '');
  const { availablePayables, isLoading: payablesLoading } =
    useAvailablePayables();
  const createMutation = useCreatePaymentOut();

  // 处理应付款选择
  const handlePayableSelect = (selectedPayableId: string) => {
    const payable = availablePayables.find(p => p.id === selectedPayableId);
    if (payable) {
      form.setValue('supplierId', payable.supplier.id);
      form.setValue('paymentAmount', payable.remainingAmount);
    }
  };

  // 提交表单
  const onSubmit = (data: CreatePaymentOutFormData) => {
    // 验证付款金额不超过剩余应付金额
    if (payableRecord && data.paymentAmount > payableRecord.remainingAmount) {
      toast({
        title: '验证失败',
        description: `付款金额不能超过剩余应付金额 ${formatCurrency(payableRecord.remainingAmount)}`,
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate(data);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      {/* 页面标题 */}
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/payments-out">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回列表
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">创建付款记录</h1>
          <p className="text-sm text-muted-foreground">填写付款信息并提交</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 主表单区域 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>付款信息</CardTitle>
              <CardDescription>请填写完整的付款信息</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentOutFormFields
                form={form}
                availablePayables={availablePayables}
                payablesLoading={payablesLoading}
                payableRecord={payableRecord}
                watchedPaymentMethod={watchedPaymentMethod}
                handlePayableSelect={handlePayableSelect}
                onSubmit={onSubmit}
                router={router}
                isPending={createMutation.isPending}
              />
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 - 应付款信息 */}
        {payableRecord && (
          <div className="lg:col-span-1">
            <PayableInfoSidebar payableRecord={payableRecord} />
          </div>
        )}
      </div>
    </div>
  );
}

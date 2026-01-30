'use client';

/**
 * 创建付款记录页面
 * 支持从应付款记录创建付款记录，包含供应商信息和应付款信息
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { cn, formatCurrency } from '@/lib/utils';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

const Calendar = dynamic(
  () => import('@/components/ui/calendar').then(mod => mod.Calendar),
  {
    ssr: false,
    loading: () => (
      <div className="h-[296px] w-[280px] animate-pulse rounded-lg bg-slate-50" />
    ),
  }
);

// 创建付款记录表单Schema
const createPaymentOutSchema = z.object({
  idempotencyKey: z.string().uuid({ message: '幂等性键格式不正确' }),
  payableRecordId: z.string().optional(),
  supplierId: z.string().min(1, { error: '请选择供应商' }),
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
      <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
        <CardTitle className="flex items-center gap-2">
          <ChineseYuan className="h-5 w-5" />
          应付款信息
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
                        <span>选择日期</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={date =>
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '')
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
    queryKey: queryKeys.payables.detail(payableId),
    queryFn: async () => {
      if (!payableId) {
        return null;
      }
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
    queryKey: queryKeys.payables.list({ status: 'pending,partial' }),
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
      const response = await fetch(
        '/api/finance/payments-out',
        getCsrfTokenHeader({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
      );

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
export function CreatePaymentOutFormSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const payableId = searchParams.get('payableId');
  const { toast } = useToast();

  // 表单配置
  const form = useForm<CreatePaymentOutFormData>({
    resolver: standardSchemaResolver(createPaymentOutSchema),
    defaultValues: {
      idempotencyKey: crypto.randomUUID(),
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
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))]">
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

      {payableRecord && (
        <div className="lg:col-span-1">
          <PayableInfoSidebar payableRecord={payableRecord} />
        </div>
      )}
    </div>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  Loader2,
  Save,
  ShoppingCart,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

// UI Components
import { useForm } from 'react-hook-form';

import { CustomerSelector } from '@/components/customers/customer-hierarchy';
import { OrderItemsEditor } from '@/components/sales-orders/order-items-editor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Icons

// Custom Components
import { Textarea } from '@/components/ui/textarea';

// API and Types
import {
  createSalesOrder,
  salesOrderQueryKeys,
  updateSalesOrder,
} from '@/lib/api/sales-orders';
import type {
  SalesOrder,
  SalesOrderCreateInput,
  SalesOrderUpdateInput,
} from '@/lib/types/sales-order';
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TRANSITIONS,
  SALES_ORDER_STATUS_VARIANTS,
} from '@/lib/types/sales-order';
import type {
  SalesOrderCreateFormData,
  SalesOrderUpdateFormData,
} from '@/lib/validations/sales-order';
import {
  salesOrderCreateDefaults,
  salesOrderCreateSchema,
  salesOrderUpdateSchema,
} from '@/lib/validations/sales-order';

interface SalesOrderFormProps {
  mode: 'create' | 'edit';
  initialData?: SalesOrder;
  onSuccess?: (salesOrder: SalesOrder) => void;
  onCancel?: () => void;
}

export function SalesOrderForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: SalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const isEdit = mode === 'edit';
  const schema = isEdit ? salesOrderUpdateSchema : salesOrderCreateSchema;

  const form = useForm<SalesOrderCreateFormData | SalesOrderUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues:
      isEdit && initialData
        ? {
            id: initialData.id,
            customerId: initialData.customerId,
            status: initialData.status,
            remarks: initialData.remarks || '',
            items:
              initialData.items?.map(item => ({
                id: item.id,
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })) || [],
          }
        : {
            ...salesOrderCreateDefaults,
            customerId: '',
          },
  });

  // 创建销售订单 Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
      if (onSuccess) {
        onSuccess(response);
      } else {
        router.push('/sales-orders');
      }
    },
    onError: error => {
      setSubmitError(
        error instanceof Error ? error.message : '创建销售订单失败'
      );
    },
  });

  // 更新销售订单 Mutation
  const updateMutation = useMutation({
    mutationFn: (data: SalesOrderUpdateInput) =>
      updateSalesOrder({ ...data, id: initialData!.id }),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: salesOrderQueryKeys.detail(response.data!.id),
      });
      if (onSuccess) {
        onSuccess(response.data!);
      } else {
        router.push('/sales-orders');
      }
    },
    onError: error => {
      setSubmitError(
        error instanceof Error ? error.message : '更新销售订单失败'
      );
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // 表单提交
  const onSubmit = async (
    data: SalesOrderCreateFormData | SalesOrderUpdateFormData
  ) => {
    setSubmitError('');

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(data as SalesOrderUpdateInput);
      } else {
        await createMutation.mutateAsync(data as SalesOrderCreateInput);
      }
    } catch (error) {
      // 错误已在 mutation 的 onError 中处理
    }
  };

  // 取消操作
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.push('/sales-orders');
    }
  };

  // 获取可用的状态选项
  const getAvailableStatuses = () => {
    if (!isEdit || !initialData) {
      return [{ value: 'draft', label: SALES_ORDER_STATUS_LABELS.draft }];
    }

    const currentStatus = initialData.status;
    const availableStatuses =
      SALES_ORDER_STATUS_TRANSITIONS[currentStatus] || [];

    return [
      { value: currentStatus, label: SALES_ORDER_STATUS_LABELS[currentStatus] },
      ...availableStatuses.map(status => ({
        value: status,
        label: SALES_ORDER_STATUS_LABELS[status],
      })),
    ];
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEdit ? '编辑销售订单' : '新增销售订单'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改销售订单信息和明细' : '创建新的销售订单'}
            </p>
          </div>
        </div>

        {/* 订单状态显示 */}
        {isEdit && initialData && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">当前状态:</span>
            <Badge variant={SALES_ORDER_STATUS_VARIANTS[initialData.status]}>
              {SALES_ORDER_STATUS_LABELS[initialData.status]}
            </Badge>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingCart className="mr-2 h-5 w-5" />
                基础信息
              </CardTitle>
              <CardDescription>
                销售订单的基本信息，包括客户、状态等
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 客户选择 */}
                <div className="md:col-span-1">
                  <CustomerSelector
                    control={form.control}
                    name="customerId"
                    label="选择客户 *"
                    placeholder="搜索客户..."
                    disabled={isLoading}
                  />
                </div>

                {/* 订单状态 */}
                {isEdit && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>订单状态</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getAvailableStatuses().map(status => (
                              <SelectItem
                                key={status.value}
                                value={status.value}
                              >
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          只能选择当前状态允许的流转状态
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 订单号显示 */}
                {isEdit && initialData && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      订单号
                    </label>
                    <p className="font-mono text-lg font-medium">
                      {initialData.orderNumber}
                    </p>
                  </div>
                )}
              </div>

              {/* 备注信息 */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <FileText className="mr-1 h-4 w-4" />
                      备注信息
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="订单的备注信息..."
                        className="min-h-[80px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      记录订单的特殊要求、交付说明等信息
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 订单明细 */}
          <OrderItemsEditor
            control={form.control}
            name="items"
            disabled={isLoading}
            mode={mode}
          />

          {/* 客户信息显示 */}
          {form.watch('customerId') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <User className="mr-2 h-4 w-4" />
                  客户信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                {form.watch('customerId') && (
                  <CustomerInfoDisplay customerId={form.watch('customerId')!} />
                )}
              </CardContent>
            </Card>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isEdit ? '保存修改' : '创建订单'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// 客户信息显示组件
interface CustomerInfoDisplayProps {
  customerId: string;
}

function CustomerInfoDisplay({ customerId }: CustomerInfoDisplayProps) {
  // 这里应该查询客户信息并显示
  // 简化处理，实际应该使用客户API

  return (
    <div className="text-sm text-muted-foreground">
      <p>客户信息加载中...</p>
    </div>
  );
}

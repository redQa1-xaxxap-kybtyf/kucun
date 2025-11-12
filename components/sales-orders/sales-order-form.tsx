'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  FileText,
  Loader2,
  Phone,
  Save,
  ShoppingCart,
  User as UserIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { useForm, type Control, type FieldValues } from 'react-hook-form';

import { CustomerSelector } from '@/components/customers/customer-hierarchy';
import { FeeItemsFormField } from '@/components/sales-orders/fee-items';
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
import { Textarea } from '@/components/ui/textarea';
import { customerQueryKeys, getCustomer } from '@/lib/api/customers';
import {
  createSalesOrder,
  salesOrderQueryKeys,
  updateSalesOrder,
} from '@/lib/api/sales-orders';
import type { Customer, CustomerExtendedInfo } from '@/lib/types/customer';
import {
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_TRANSITIONS,
  SALES_ORDER_STATUS_VARIANTS,
  type SalesOrder,
  type SalesOrderCreateInput,
  type SalesOrderUpdateInput,
} from '@/lib/types/sales-order';
import { getDefaultFeePaidBy } from '@/lib/types/sales-order-fee';
import { logger } from '@/lib/utils/console-logger';
import {
  salesOrderFormSchema,
  type SalesOrderFormData,
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

  // ✅ 表单配置 - 使用统一的表单Schema,避免联合类型
  const isEdit = mode === 'edit';

  const form = useForm<SalesOrderFormData>({
    resolver: standardSchemaResolver(salesOrderFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
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
            feeItems:
              initialData.feeItems?.map(fee => ({
                ...fee,
                paidBy: fee.paidBy ?? getDefaultFeePaidBy(fee.feeType),
              })) || [],
          }
        : {
            customerId: '',
            status: 'draft',
            items: [],
            remarks: '',
            feeItems: [],
          },
  });

  // 创建销售订单 Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: response => {
      // ✅ 失效销售订单缓存
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      // ✅ 关键修复：同时失效应收款缓存
      queryClient.invalidateQueries({ queryKey: ['finance', 'receivables'] });

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
    mutationFn: (data: SalesOrderUpdateInput) => {
      if (!initialData?.id) {
        throw new Error('初始数据缺失，无法更新订单');
      }
      return updateSalesOrder({ ...data, id: initialData.id });
    },
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
      if (response.data) {
        queryClient.invalidateQueries({
          queryKey: salesOrderQueryKeys.detail(response.data.id),
        });
        if (onSuccess) {
          onSuccess(response.data);
        } else {
          router.push('/sales-orders');
        }
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
  const onSubmit = async (data: SalesOrderFormData) => {
    setSubmitError('');

    try {
      if (isEdit) {
        // 更新时需要包含 id
        await updateMutation.mutateAsync(data as SalesOrderUpdateInput);
      } else {
        // 创建时不需要 id
        const { id: _id, ...createData } = data;
        await createMutation.mutateAsync(createData as SalesOrderCreateInput);
      }
    } catch (error) {
      logger.error(
        'sales-orders:form',
        '[SalesOrderForm] 销售订单提交失败',
        error
      );
    }
  };

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void (async () => {
        const isCustomerValid = await form.trigger('customerId');
        if (!isCustomerValid) {
          try {
            form.setFocus('customerId');
          } catch (error) {
            logger.debug(
              'sales-orders:form',
              'Failed to focus customer selector',
              error
            );
          }
          setSubmitError('请选择客户');
          return;
        }

        // ✅ 使用类型断言以兼容 standardSchemaResolver
        await form.handleSubmit((data: any) =>
          onSubmit(data as SalesOrderFormData)
        )();
      })();
    },
    [form, onSubmit]
  );

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
            <span className="text-muted-foreground text-sm">当前状态:</span>
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
        <form onSubmit={handleFormSubmit} className="space-y-6">
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
                    <label className="text-muted-foreground text-sm font-medium">
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
            control={form.control as unknown as Control<FieldValues>}
            name="items"
            disabled={isLoading}
            mode={mode}
          />

          {/* 额外费用 */}
          <Card>
            <CardHeader>
              <CardTitle>额外费用</CardTitle>
              <CardDescription>添加加工费、运费等额外费用项目</CardDescription>
            </CardHeader>
            <CardContent>
              <FeeItemsFormField control={form.control} disabled={isLoading} />
            </CardContent>
          </Card>

          {/* 客户信息显示 */}
          {form.watch('customerId') && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <UserIcon className="mr-2 h-4 w-4" />
                  客户信息
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const customerId = form.watch('customerId');
                  return customerId ? (
                    <CustomerInfoDisplay customerId={customerId} />
                  ) : null;
                })()}
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
  const {
    data: customer,
    isLoading,
    error,
  } = useQuery<Customer, Error>({
    queryKey: customerQueryKeys.detail(customerId),
    queryFn: () => getCustomer(customerId),
    enabled: !!customerId,
  });

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center space-x-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>加载客户信息中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-sm text-red-500">
        <AlertCircle className="h-4 w-4" />
        <span>加载客户信息失败: {error.message}</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-muted-foreground text-sm">
        <p>未找到客户信息。</p>
      </div>
    );
  }

  const extendedInfo: CustomerExtendedInfo | undefined = customer.extendedInfo
    ? JSON.parse(customer.extendedInfo)
    : undefined;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center space-x-2">
        <UserIcon className="text-muted-foreground h-4 w-4" />
        <span className="font-medium">{customer.name}</span>
      </div>
      {customer.phone && (
        <div className="text-muted-foreground flex items-center space-x-2">
          <Phone className="h-4 w-4" />
          <span>{customer.phone}</span>
        </div>
      )}
      {customer.address && (
        <div className="text-muted-foreground flex items-center space-x-2">
          <Building2 className="h-4 w-4" />
          <span>{customer.address}</span>
        </div>
      )}
      {extendedInfo?.contactPerson && (
        <div className="text-muted-foreground flex items-center space-x-2">
          <span>联系人: {extendedInfo.contactPerson}</span>
        </div>
      )}
      {/* 可以根据需要添加更多客户信息 */}
    </div>
  );
}

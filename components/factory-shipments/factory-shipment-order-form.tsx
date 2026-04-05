'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, type FieldErrors } from 'react-hook-form';

import { FeeItemsFormField } from '@/components/factory-shipments/fee-items';
import { AmountInfoSection } from '@/components/factory-shipments/form-sections/amount-info-section';
import { BasicInfoSection } from '@/components/factory-shipments/form-sections/basic-info-section';
import { ItemListSection } from '@/components/factory-shipments/form-sections/item-list-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { useCustomerPriceHistory } from '@/hooks/use-price-history';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import {
  FactoryShipmentValidationError,
  useCreateFactoryShipmentOrder,
  useFactoryShipmentOrder,
  useUpdateFactoryShipmentOrder,
} from '@/lib/api/factory-shipments';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { useFormErrorHandling } from '@/lib/hooks/useFormErrorHandling';
import type { Customer } from '@/lib/types/customer';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import {
  prepareFactoryShipmentForSubmit,
  transformFactoryShipmentFromAPI,
} from '@/lib/utils/factory-shipment-transforms';
import { createFactoryShipmentDraftItem } from '@/lib/utils/order-form-defaults';
import {
  factoryShipmentOrderFormSchema,
  type FactoryShipmentOrderFormData,
} from '@/lib/validations/factory-shipment';

const generateIdempotencyKey = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

interface FactoryShipmentOrderFormProps {
  orderId?: string;
  onSuccess?: (order: FactoryShipmentOrder) => void;
  onCancel?: () => void;
}

export function FactoryShipmentOrderForm({
  orderId,
  onSuccess,
  onCancel,
}: FactoryShipmentOrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(orderId);
  const submitIntentRef = useRef<'draft' | 'confirm'>('confirm');
  const [submitIntent, setSubmitIntent] = useState<'draft' | 'confirm'>(
    'confirm'
  );

  // ✅ 表单配置 - 使用表单专用Schema,移除.default()和.transform()
  const form = useForm<FactoryShipmentOrderFormData>({
    resolver: standardSchemaResolver(factoryShipmentOrderFormSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      idempotencyKey: generateIdempotencyKey(),
      containerNumber: '',
      customerId: '',
      status: FACTORY_SHIPMENT_STATUS.DRAFT,
      totalAmount: 0,
      receivableAmount: 0,
      depositAmount: 0,
      remarks: '',
      items: [createFactoryShipmentDraftItem()],
      feeItems: [], // 在defaultValues中设置默认值,而非Schema中
    },
  });

  const { notifyBlur, showValidationToast, applyServerValidationErrors } =
    useFormErrorHandling({
      form,
      toast,
    });

  // 产品明细字段数组
  const fieldArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const handleServerValidationError = useCallback(
    (error: FactoryShipmentValidationError, fallbackTitle: string) => {
      const firstMessage =
        applyServerValidationErrors(error.details) ||
        error.message ||
        '数据验证失败，请检查后重试。';

      toast({
        title: fallbackTitle,
        description: firstMessage,
        variant: 'destructive',
      });
    },
    [applyServerValidationErrors, toast]
  );

  // 查询基础数据
  // 使用合理的客户列表限制（与销售订单保持一致）
  const customersQueryParams = {
    page: 1,
    limit: 100,
    sortBy: 'createdAt' as const,
    sortOrder: 'desc' as const,
  };

  const customersQueryKey = customerQueryKeys.list(customersQueryParams);

  const { data: customersResponse, isLoading: customersLoading } = useQuery({
    queryKey: customersQueryKey,
    queryFn: () => getCustomers(customersQueryParams),
  });
  const customers = customersResponse?.data || [];

  // 产品查询参数（与销售订单保持一致，避免使用过大的 limit）
  const productsQueryParams = {
    includeInventory: true,
    includeStatistics: false,
    includeBatchSpecs: true,
  };

  const { data: productsResponse, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list(productsQueryParams),
    queryFn: () => getProducts(productsQueryParams),
  });
  const products = productsResponse?.data || [];

  // 监听客户选择，用于价格历史查询
  const selectedCustomerId = form.watch('customerId');

  // 查询客户价格历史（厂家发货价格类型）
  const { data: customerPriceHistoryData } = useCustomerPriceHistory({
    customerId: selectedCustomerId,
    priceType: 'FACTORY',
  });

  // 查询订单详情（编辑模式）
  const { data: orderDetail } = useFactoryShipmentOrder(
    isEditing ? orderId || '' : ''
  );

  // 创建订单mutation
  const createMutation = useCreateFactoryShipmentOrder();

  // 更新订单mutation
  const updateMutation = useUpdateFactoryShipmentOrder();

  // 填充编辑数据
  useEffect(() => {
    if (orderDetail && isEditing) {
      const normalized = transformFactoryShipmentFromAPI(orderDetail);
      // ✅ 使用类型断言,因为API数据与表单数据结构兼容
      form.reset({
        ...normalized,
        items: normalized.items?.length
          ? normalized.items
          : [createFactoryShipmentDraftItem()],
        idempotencyKey: generateIdempotencyKey(),
      } as any);
    }
  }, [form, isEditing, orderDetail]);

  // 监听金额相关字段变化，自动计算：
  // - 订单总金额 = 全部明细金额合计
  // - 应收金额 = 客户货金额 + 客户承担费用 - 定金
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      // 避免我们自己 setValue(totalAmount/receivableAmount) 触发死循环
      if (name === 'totalAmount' || name === 'receivableAmount') {
        return;
      }

      // 只在明细、费用或定金变化时重新计算
      if (
        name &&
        !name.startsWith('items') &&
        !name.startsWith('feeItems') &&
        name !== 'depositAmount'
      ) {
        return;
      }

      const items = value.items || [];
      const feeItems = value.feeItems || [];
      const depositAmount = Number(value.depositAmount || 0) || 0;

      // 明细金额汇总（和后端 computeAmountSummary 保持一致）
      const summary = items.reduce(
        (acc, item) => {
          if (!item) return acc;
          const quantity = Number(item.quantity || 0) || 0;
          const unitPrice = Number(item.unitPrice || 0) || 0;
          const lineTotal = quantity * unitPrice;

          acc.total += lineTotal;
          const ownership = item.ownership || 'customer';
          if (ownership === 'customer') {
            acc.customer += lineTotal;
          } else {
            acc.self += lineTotal;
          }
          return acc;
        },
        { total: 0, customer: 0, self: 0 }
      );

      // 客户承担的费用
      const customerFees = feeItems.reduce((sum: number, fee: any) => {
        if (!fee || fee.paidBy !== 'customer') return sum;
        const amount = Number(fee.feeAmount || 0) || 0;
        return sum + amount;
      }, 0);

      const totalAmount = summary.total;
      const finalReceivableAmount = Math.max(
        0,
        summary.customer + customerFees - depositAmount
      );

      form.setValue('totalAmount', totalAmount);
      form.setValue('receivableAmount', finalReceivableAmount);
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // 提交表单
  const onSubmit = (data: FactoryShipmentOrderFormData) => {
    const intent = submitIntentRef.current;
    const resolvedStatus = isEditing
      ? data.status || FACTORY_SHIPMENT_STATUS.DRAFT
      : intent === 'draft'
        ? FACTORY_SHIPMENT_STATUS.DRAFT
        : FACTORY_SHIPMENT_STATUS.CONFIRMED;
    // ✅ 使用类型断言,因为表单数据与API数据结构兼容
    const payload = prepareFactoryShipmentForSubmit({
      ...data,
      status: resolvedStatus,
    } as any);

    if (isEditing) {
      // 确保更新时有 idempotencyKey
      const updateData = {
        ...payload,
        idempotencyKey: payload.idempotencyKey || generateIdempotencyKey(),
      };

      updateMutation.mutate(
        {
          id: orderId as string,
          data: updateData,
        },
        {
          onSuccess: updatedOrder => {
            toast({
              title: '更新成功',
              description: `厂家发货订单 ${updatedOrder.orderNumber} 已更新。`,
              variant: 'success',
            });
            onSuccess?.(updatedOrder);
          },
          onError: error => {
            if (error instanceof FactoryShipmentValidationError) {
              handleServerValidationError(error, '更新失败');
              return;
            }
            toast({
              title: '更新失败',
              description:
                error instanceof Error
                  ? error.message
                  : '更新厂家发货订单失败，请稍后重试。',
              variant: 'destructive',
            });
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: createdOrder => {
          toast({
            title: intent === 'draft' ? '草稿已保存' : '新建成功',
            description:
              intent === 'draft'
                ? `厂家发货订单 ${createdOrder.orderNumber} 已保存为草稿，可随时继续编辑。`
                : `厂家发货订单 ${createdOrder.orderNumber} 已提交并进入正式发货流程。`,
            variant: 'success',
          });
          onSuccess?.(createdOrder);
          handleSubmitIntent('confirm');
          form.reset({
            idempotencyKey: generateIdempotencyKey(),
            containerNumber: '',
            customerId: '',
            status: FACTORY_SHIPMENT_STATUS.DRAFT,
            totalAmount: 0,
            receivableAmount: 0,
            depositAmount: 0,
            remarks: '',
            items: [createFactoryShipmentDraftItem()],
            feeItems: [],
          });
        },
        onError: error => {
          if (error instanceof FactoryShipmentValidationError) {
            handleServerValidationError(error, '新建失败');
            return;
          }
          toast({
            title: '新建失败',
            description:
              error instanceof Error
                ? error.message
                : '新建厂家发货单失败，请稍后重试。',
            variant: 'destructive',
          });
        },
      });
    }
  };

  const handleInvalidSubmit = (
    errors: FieldErrors<FactoryShipmentOrderFormData>
  ) => {
    showValidationToast(errors, {
      description:
        '请检查标红字段后再次提交。所有带 * 的字段均为必填项，手动产品需填写名称。',
    });
  };

  // 处理客户创建成功
  const handleCustomerCreated = (customer: Customer) => {
    // 刷新客户列表
    queryClient.invalidateQueries({
      queryKey: customersQueryKey,
    });
    // 自动选择新创建的客户
    form.setValue('customerId', customer.id);
  };

  // 处理刷新客户列表
  const handleRefreshCustomers = () => {
    queryClient.invalidateQueries({
      queryKey: customersQueryKey,
    });
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const handleSubmitIntent = (intent: 'draft' | 'confirm') => {
    submitIntentRef.current = intent;
    setSubmitIntent(intent);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(
          (data: any) => onSubmit(data as FactoryShipmentOrderFormData),
          handleInvalidSubmit
        )}
        className="space-y-8"
      >
        {/* 基本信息 */}
        <BasicInfoSection
          form={form}
          customers={customers}
          showStatus={isEditing}
          isLoadingCustomers={customersLoading}
          onCustomerCreated={handleCustomerCreated}
          onRefreshCustomers={handleRefreshCustomers}
          initialCustomer={orderDetail?.customer}
          getBlurHandler={notifyBlur}
        />

        {/* 产品明细 */}
        <ItemListSection
          form={form}
          fieldArray={fieldArray}
          products={products}
          selectedCustomerId={selectedCustomerId}
          customerPriceHistoryData={customerPriceHistoryData}
          getBlurHandler={notifyBlur}
        />

        {/* 费用项目 */}
        <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] shadow-md">
          <CardHeader className="border-b border-[hsl(var(--color-border-secondary))] bg-[hsl(var(--color-bg-secondary))] py-3">
            <CardTitle className="text-base font-semibold text-[hsl(var(--color-text-primary))]">
              费用项目
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <FeeItemsFormField control={form.control} disabled={isLoading} />
          </CardContent>
        </Card>

        {/* 金额信息 */}
        <AmountInfoSection form={form} />

        {/* 操作按钮 */}
        <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-primary))] shadow-md">
          <CardContent className="p-8">
            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onCancel}
                disabled={isLoading}
                className="min-w-[120px] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回
              </Button>
              {isEditing ? (
                <Button
                  type="submit"
                  size="lg"
                  disabled={isLoading}
                  className="min-w-[160px] shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isLoading ? '保存中...' : '保存修改'}
                </Button>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="outline"
                    size="lg"
                    disabled={isLoading}
                    onClick={() => handleSubmitIntent('draft')}
                    className="min-w-[140px] shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isLoading && submitIntent === 'draft'
                      ? '草稿保存中...'
                      : '保存草稿'}
                  </Button>
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isLoading}
                    onClick={() => handleSubmitIntent('confirm')}
                    className="min-w-[160px] shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {isLoading && submitIntent === 'confirm'
                      ? '保存中...'
                      : '新建发货单'}
                  </Button>
                </div>
              )}
            </div>
            {!isEditing && (
              <p className="text-muted-foreground mt-4 text-sm">
                保存草稿：用于临时保存，稍后可继续编辑；新建发货单：提交后进入正式发货流程。
              </p>
            )}
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

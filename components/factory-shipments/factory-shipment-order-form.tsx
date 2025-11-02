'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { AmountInfoSection } from '@/components/factory-shipments/form-sections/amount-info-section';
import { BasicInfoSection } from '@/components/factory-shipments/form-sections/basic-info-section';
import { ItemListSection } from '@/components/factory-shipments/form-sections/item-list-section';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { useCustomerPriceHistory } from '@/hooks/use-price-history';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import {
  useCreateFactoryShipmentOrder,
  useFactoryShipmentOrder,
  useUpdateFactoryShipmentOrder,
} from '@/lib/api/factory-shipments';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import type { Customer } from '@/lib/types/customer';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';
import {
  createFactoryShipmentOrderSchema,
  type CreateFactoryShipmentOrderData,
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

const createEmptyItem = () => ({
  productId: undefined as string | undefined,
  supplierId: '',
  productCode: '', // 产品编码（必填）
  quantity: 1,
  unitPrice: 0,
  ownership: 'customer' as const,
  displayName: '', // 产品名称（必填，默认空字符串）
  specification: '', // 规格（可选，默认空字符串）
  unit: '片' as '片' | '件',
  weight: undefined as number | undefined, // 重量（可选）
  ownershipRemarks: '', // 归属备注（可选，默认空字符串）
  remarks: '', // 备注（可选，默认空字符串）
});

interface FactoryShipmentOrderFormProps {
  orderId?: string;
  onSuccess?: (order: FactoryShipmentOrder) => void;
  onCancel?: () => void;
}

/**
 * 厂家发货订单表单组件
 * 重构后的版本，拆分为多个子组件，符合代码质量标准
 */
export function FactoryShipmentOrderForm({
  orderId,
  onSuccess,
  onCancel,
}: FactoryShipmentOrderFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = Boolean(orderId);

  // 表单配置
  const form = useForm<CreateFactoryShipmentOrderData>({
    resolver: zodResolver(createFactoryShipmentOrderSchema),
    defaultValues: {
      idempotencyKey: generateIdempotencyKey(),
      containerNumber: '',
      customerId: '',
      status: FACTORY_SHIPMENT_STATUS.DRAFT,
      totalAmount: 0,
      receivableAmount: 0,
      depositAmount: 0,
      remarks: '',
      items: [createEmptyItem()],
    },
  });

  // 商品明细字段数组
  const fieldArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

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
      form.reset({
        idempotencyKey: generateIdempotencyKey(),
        containerNumber: orderDetail.containerNumber || '',
        customerId: orderDetail.customerId,
        status: orderDetail.status,
        totalAmount: orderDetail.totalAmount,
        receivableAmount: orderDetail.receivableAmount,
        depositAmount: orderDetail.depositAmount,
        remarks: orderDetail.remarks || '',
        items: orderDetail.items?.map(item => ({
          productId: item.productId ?? undefined,
          supplierId: item.supplierId,
          productCode: item.productCode || '', // 产品编码（必填）
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ownership: item.ownership || 'customer',
          displayName: item.displayName || '', // 产品名称（必填）
          specification: item.specification || '', // 规格（可选）
          unit: (item.unit === '片' || item.unit === '件'
            ? item.unit
            : '片') as '片' | '件',
          weight: item.weight ?? undefined, // 重量（可选，保持 undefined）
          ownershipRemarks: item.ownershipRemarks || '', // 归属备注（可选）
          remarks: item.remarks || '', // 备注（可选）
        })) || [createEmptyItem()],
      });
    }
  }, [orderDetail, isEditing, form]);

  // 监听商品明细变化，自动计算总金额
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.startsWith('items')) {
        const items = value.items || [];
        const total = items.reduce((sum, item) => {
          const quantity = item?.quantity || 0;
          const unitPrice = item?.unitPrice || 0;
          return sum + quantity * unitPrice;
        }, 0);
        const customerAmount = items.reduce((sum, item) => {
          const ownership = item?.ownership || 'customer';
          if (ownership !== 'customer') {
            return sum;
          }
          const quantity = item?.quantity || 0;
          const unitPrice = item?.unitPrice || 0;
          return sum + quantity * unitPrice;
        }, 0);
        form.setValue('totalAmount', total);
        form.setValue('receivableAmount', customerAmount);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // 提交表单
  const onSubmit = (data: CreateFactoryShipmentOrderData) => {
    if (isEditing) {
      // 确保更新时有 idempotencyKey
      const updateData = {
        ...data,
        idempotencyKey: data.idempotencyKey || generateIdempotencyKey(),
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
      createMutation.mutate(data, {
        onSuccess: createdOrder => {
          toast({
            title: '创建成功',
            description: `厂家发货订单 ${createdOrder.orderNumber} 已创建。`,
            variant: 'success',
          });
          onSuccess?.(createdOrder);
          form.reset({
            idempotencyKey: generateIdempotencyKey(),
            containerNumber: '',
            customerId: '',
            status: FACTORY_SHIPMENT_STATUS.DRAFT,
            totalAmount: 0,
            receivableAmount: 0,
            depositAmount: 0,
            remarks: '',
            items: [createEmptyItem()],
          });
        },
        onError: error => {
          toast({
            title: '创建失败',
            description:
              error instanceof Error
                ? error.message
                : '创建厂家发货订单失败，请稍后重试。',
            variant: 'destructive',
          });
        },
      });
    }
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本信息 */}
        <BasicInfoSection
          form={form}
          customers={customers}
          showStatus={isEditing}
          isLoadingCustomers={customersLoading}
          onCustomerCreated={handleCustomerCreated}
          onRefreshCustomers={handleRefreshCustomers}
        />

        {/* 商品明细 */}
        <ItemListSection
          form={form}
          fieldArray={fieldArray}
          products={products}
          selectedCustomerId={selectedCustomerId}
          customerPriceHistoryData={customerPriceHistoryData}
        />

        {/* 金额信息 */}
        <AmountInfoSection form={form} />

        {/* 操作按钮 */}
        <Card className="overflow-hidden border-[hsl(var(--color-border-primary))] bg-gradient-to-r from-[hsl(var(--color-bg-secondary))] to-[hsl(var(--color-bg-primary))] shadow-md">
          <CardContent className="p-6">
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
              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="min-w-[160px] shadow-md transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              >
                <Save className="mr-2 h-4 w-4" />
                {isLoading ? '保存中...' : isEditing ? '更新订单' : '创建订单'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}

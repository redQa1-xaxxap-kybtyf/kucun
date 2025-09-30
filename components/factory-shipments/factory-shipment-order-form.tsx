'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { AmountInfoSection } from '@/components/factory-shipments/form-sections/amount-info-section';
import { BasicInfoSection } from '@/components/factory-shipments/form-sections/basic-info-section';
import { ItemListSection } from '@/components/factory-shipments/form-sections/item-list-section';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import { useCustomerPriceHistory } from '@/hooks/use-price-history';
import { getCustomers } from '@/lib/api/customers';
import { getProducts } from '@/lib/api/products';
import { factoryShipmentConfig } from '@/lib/env';
import {
  createFactoryShipmentOrderSchema,
  type CreateFactoryShipmentOrderData,
} from '@/lib/schemas/factory-shipment';
import {
  FACTORY_SHIPMENT_STATUS,
  type FactoryShipmentOrder,
} from '@/lib/types/factory-shipment';

interface FactoryShipmentOrderFormProps {
  orderId?: string;
  onSuccess?: (order: FactoryShipmentOrder) => void;
  onCancel?: () => void;
}

// 模拟API调用 - 后续替换为真实API
const createFactoryShipmentOrder = async (
  data: CreateFactoryShipmentOrderData
): Promise<FactoryShipmentOrder> =>
  // TODO: 实现真实API调用
  ({ id: 'mock-id', ...data }) as FactoryShipmentOrder;

const updateFactoryShipmentOrder = async (
  id: string,
  data: CreateFactoryShipmentOrderData
): Promise<FactoryShipmentOrder> =>
  // TODO: 实现真实API调用
  ({ id, ...data }) as FactoryShipmentOrder;

const getFactoryShipmentOrder = async (
  _id: string
): Promise<FactoryShipmentOrder | null> =>
  // TODO: 实现真实API调用
  null;

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
      containerNumber: '',
      customerId: '',
      status: FACTORY_SHIPMENT_STATUS.DRAFT,
      totalAmount: 0,
      receivableAmount: 0,
      depositAmount: 0,
      remarks: '',
      items: [
        {
          productId: '',
          supplierId: '',
          quantity: 1,
          unitPrice: 0,
          displayName: '',
          specification: '',
          unit: '件',
          remarks: '',
        },
      ],
    },
  });

  // 商品明细字段数组
  const fieldArray = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 查询基础数据
  const { data: customersResponse } = useQuery({
    queryKey: ['customers'],
    queryFn: () =>
      getCustomers({ page: 1, limit: factoryShipmentConfig.queryLimit }),
  });
  const customers = customersResponse?.data || [];

  const { data: productsResponse } = useQuery({
    queryKey: ['products'],
    queryFn: () =>
      getProducts({ page: 1, limit: factoryShipmentConfig.queryLimit }),
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
  const { data: orderDetail } = useQuery({
    queryKey: ['factory-shipment-order', orderId],
    queryFn: () => (orderId ? getFactoryShipmentOrder(orderId) : null),
    enabled: isEditing,
  });

  // 创建订单mutation
  const createMutation = useMutation({
    mutationFn: createFactoryShipmentOrder,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: '厂家发货订单创建成功',
      });
      queryClient.invalidateQueries({ queryKey: ['factory-shipment-orders'] });
      onSuccess?.(data);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description:
          error instanceof Error ? error.message : '创建厂家发货订单失败',
        variant: 'destructive',
      });
    },
  });

  // 更新订单mutation
  const updateMutation = useMutation({
    mutationFn: (data: CreateFactoryShipmentOrderData) => {
      if (!orderId) {
        throw new Error('订单ID不能为空');
      }
      return updateFactoryShipmentOrder(orderId, data);
    },
    onSuccess: data => {
      toast({
        title: '更新成功',
        description: '厂家发货订单更新成功',
      });
      queryClient.invalidateQueries({ queryKey: ['factory-shipment-orders'] });
      queryClient.invalidateQueries({
        queryKey: ['factory-shipment-order', orderId],
      });
      onSuccess?.(data);
    },
    onError: error => {
      toast({
        title: '更新失败',
        description:
          error instanceof Error ? error.message : '更新厂家发货订单失败',
        variant: 'destructive',
      });
    },
  });

  // 填充编辑数据
  useEffect(() => {
    if (orderDetail && isEditing) {
      form.reset({
        containerNumber: orderDetail.containerNumber || '',
        customerId: orderDetail.customerId,
        status: orderDetail.status,
        totalAmount: orderDetail.totalAmount,
        receivableAmount: orderDetail.receivableAmount,
        depositAmount: orderDetail.depositAmount,
        remarks: orderDetail.remarks || '',
        planDate: orderDetail.planDate
          ? new Date(orderDetail.planDate)
          : undefined,
        items: orderDetail.items?.map(item => ({
          productId: item.productId || '',
          supplierId: item.supplierId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          displayName: item.displayName,
          specification: item.specification || '',
          unit: item.unit,
          weight: item.weight,
          remarks: item.remarks || '',
        })) || [
          {
            productId: '',
            supplierId: '',
            quantity: 1,
            unitPrice: 0,
            displayName: '',
            specification: '',
            unit: 'piece',
            remarks: '',
          },
        ],
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
        form.setValue('totalAmount', total);
        form.setValue('receivableAmount', total);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // 提交表单
  const onSubmit = (data: CreateFactoryShipmentOrderData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本信息 */}
        <BasicInfoSection form={form} customers={customers} />

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
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <Button type="submit" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {isLoading ? '保存中...' : isEditing ? '更新订单' : '创建订单'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/* eslint-disable max-lines-per-function, max-lines */
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { CustomerSalesOrderSelector } from '@/components/return-orders/customer-sales-order-selector';
import {
  ReturnItemsSection,
  type ReturnOrderSelectableItem,
  type ReturnOrderProductInfo,
} from '@/components/return-orders/erp-return-order-form/ReturnItemsSection';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import { useToast } from '@/components/ui/use-toast';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import {
  useCreateReturnOrder,
  useSalesOrderReturnableItems,
  useUpdateReturnOrder,
} from '@/lib/api/return-orders';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  type ReturnOrder,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  RETURN_ORDER_MODE_LABELS,
} from '@/lib/types/return-order';
import {
  type CreateReturnOrderFormData,
  type UpdateReturnOrderFormData,
  createReturnOrderDefaults,
  createReturnOrderSchema,
  updateReturnOrderSchema,
} from '@/lib/validations/return-order';

interface ERPReturnOrderFormProps {
  mode?: 'create' | 'edit';
  initialData?: ReturnOrder;
  onSuccess?: (result: ReturnOrder) => void;
  onCancel?: () => void;
}

/**
 * ERP风格的退货订单表单组件
 * 采用紧凑布局，符合中国ERP系统用户习惯
 */
export function ERPReturnOrderForm({
  mode = 'create',
  initialData,
  onSuccess,
  onCancel,
}: ERPReturnOrderFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // 表单设置
  const form = useForm<CreateReturnOrderFormData | UpdateReturnOrderFormData>({
    resolver: zodResolver(
      mode === 'create' ? createReturnOrderSchema : updateReturnOrderSchema
    ),
    defaultValues:
      mode === 'create'
        ? createReturnOrderDefaults
        : {
            returnMode: initialData?.returnMode || 'single_order',
            salesOrderId: initialData?.salesOrderId || '',
            customerId: initialData?.customerId || '',
            type: initialData?.type || 'quality_issue',
            processType: initialData?.processType || 'refund',
            reason: initialData?.reason || '',
            remarks: initialData?.remarks || '',
            items:
              initialData?.items?.map(item => ({
                salesOrderItemId: item.salesOrderItemId,
                productId: item.productId,
                returnQuantity: item.returnQuantity,
                damagedQuantity: item.damagedQuantity || 0,
                originalQuantity: item.originalQuantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                reason: item.reason,
              })) || [],
          },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 获取客户列表
  const { data: customersData, isLoading: isLoadingCustomers } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  // 获取销售订单列表（根据选中的客户筛选）
  // 注意: 当选择客户后，会自动根据 customerId 过滤订单
  const { data: salesOrdersData, isLoading: isLoadingSalesOrders } = useQuery({
    queryKey: salesOrderQueryKeys.list({
      page: 1,
      limit: 100,
      customerId: selectedCustomerId || undefined,
    }),
    queryFn: () =>
      getSalesOrders({
        page: 1,
        limit: 100,
        customerId: selectedCustomerId || undefined,
      }),
    // 移除 enabled 限制，允许加载所有订单供选择
    enabled: true,
  });

  // 确保数据始终是数组类型
  const customers = Array.isArray(customersData?.data)
    ? customersData.data
    : [];
  const salesOrders = Array.isArray(salesOrdersData?.data)
    ? salesOrdersData.data
    : [];

  // 监听销售订单变化

  const returnMode =
    form.watch('returnMode') ??
    (initialData?.returnMode as 'single_order' | 'multi_order' | undefined) ??
    'single_order';
  const watchedSalesOrderId = form.watch('salesOrderId');
  useEffect(() => {
    if (watchedSalesOrderId && watchedSalesOrderId !== selectedSalesOrderId) {
      setSelectedSalesOrderId(watchedSalesOrderId);
      // 清空现有明细
      replace([]);
      setProductInfoMap({});
    }
  }, [watchedSalesOrderId, selectedSalesOrderId, replace]);

  // 获取可退货明细
  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(selectedSalesOrderId, {
      enabled: !!selectedSalesOrderId,
    });

  // 保存产品信息的状态，用于显示
  const [productInfoMap, setProductInfoMap] = useState<
    Record<string, ReturnOrderProductInfo>
  >({});

  // 当可退货明细加载完成后，自动填充到表单
  useEffect(() => {
    if (
      returnableItemsData?.data?.returnableItems &&
      returnableItemsData.data.returnableItems.length > 0
    ) {
      // 构建产品信息映射
      const newProductInfoMap: Record<string, ReturnOrderProductInfo> = {};
      returnableItemsData.data.returnableItems.forEach(item => {
        newProductInfoMap[item.productId] = {
          name: item.product.name,
          code: item.product.code,
          unit: item.product.unit,
          specification: item.product.specification ?? null,
        };
      });
      setProductInfoMap(newProductInfoMap);

      // 将可退货明细转换为表单格式并填充
      const formItems = returnableItemsData.data.returnableItems.map(item => ({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        colorCode: item.colorCode || undefined,
        productionDate: item.productionDate || undefined,
        returnQuantity: 0, // 默认退货数量为0，用户需要手动填写
        damagedQuantity: 0,
        originalQuantity: item.availableQuantity,
        unitPrice: item.unitPrice,
        subtotal: 0,
        reason: '',
        condition: 'good' as const, // 默认状态为良好
      }));

      replace(formItems);
      setProductInfoMap(newProductInfoMap);
    } else if (returnableItemsData?.data?.returnableItems?.length === 0) {
      replace([]);
      setProductInfoMap({});
    }
  }, [returnableItemsData, replace]);

  // Mutations
  const createMutation = useCreateReturnOrder({
    onSuccess: response => {
      toast({
        title: '创建成功',
        description: `退货订单 ${response.data.returnNumber} 已创建`,
        variant: 'success',
      });
      onSuccess?.(response.data);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error.message || '创建退货订单时发生错误',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useUpdateReturnOrder({
    onSuccess: response => {
      toast({
        title: '更新成功',
        description: `退货订单 ${response.data.returnNumber} 已更新`,
        variant: 'success',
      });
      onSuccess?.(response.data);
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message || '更新退货订单时发生错误',
        variant: 'destructive',
      });
    },
  });

  // 计算明细小计
  const calculateSubtotal = (index: number) => {
    const quantity = form.watch(`items.${index}.returnQuantity`);
    const unitPrice = form.watch(`items.${index}.unitPrice`);
    const subtotal = quantity * unitPrice;
    form.setValue(`items.${index}.subtotal`, subtotal);
  };

  // 计算总金额
  const calculateTotal = () => {
    const items = form.watch('items');
    return items?.reduce((total, item) => total + (item.subtotal || 0), 0) || 0;
  };

  const handleAddEmptyItem = useCallback(() => {
    append({
      salesOrderItemId: '',
      productId: '',
      colorCode: undefined,
      productionDate: undefined,
      returnQuantity: 1,
      damagedQuantity: 0,
      originalQuantity: 1,
      unitPrice: 0,
      subtotal: 0,
      reason: '',
      condition: 'good',
    });
  }, [append]);

  const handleMultiOrderItemSelect = useCallback(
    (item: ReturnOrderSelectableItem) => {
      append({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        colorCode: item.colorCode || undefined,
        productionDate: item.productionDate || undefined,
        returnQuantity: item.returnQuantity,
        damagedQuantity: item.damagedQuantity ?? 0,
        originalQuantity: item.originalQuantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal ?? item.returnQuantity * item.unitPrice,
        reason: item.reason || '',
        condition: item.condition,
      });
      setProductInfoMap(prev => ({
        ...prev,
        [item.productId]: {
          ...item.productInfo,
          salesOrderNumber: item.salesOrderNumber,
        },
      }));
    },
    [append, setProductInfoMap]
  );

  // 表单提交
  const onSubmit = (
    data: CreateReturnOrderFormData | UpdateReturnOrderFormData
  ) => {
    if (mode === 'edit' && initialData) {
      const updateData = {
        id: initialData.id,
        data: data as UpdateReturnOrderFormData,
      };
      updateMutation.mutate(updateData);
    } else {
      const createData: CreateReturnOrderFormData =
        data as CreateReturnOrderFormData;
      createMutation.mutate(createData);
    }
  };

  // 处理取消
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="bg-card rounded border">
      {/* ERP标准工具栏 */}
      <div className="bg-muted/30 border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {mode === 'create' ? '新建退货订单' : '编辑退货订单'}
          </h3>
          <div className="text-muted-foreground text-xs">
            {mode === 'create' ? '填写退货信息' : '修改退货信息'}
          </div>
        </div>
      </div>

      {/* 操作工具栏 */}
      <div className="bg-muted/10 border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={handleCancel}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-1 h-3 w-3" />
              返回
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-1 h-3 w-3" />
              )}
              {isLoading
                ? '保存中...'
                : mode === 'create'
                  ? '创建退货订单'
                  : '保存修改'}
            </Button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-b bg-red-50 px-3 py-2">
          <div className="text-xs text-red-600">
            {mode === 'create' ? '创建失败' : '更新失败'}: {error.message}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
          {/* 基本信息 */}
          <div className="bg-muted/5 border-b px-3 py-2">
            <div className="text-muted-foreground text-xs">基本信息</div>
          </div>
          <div className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <FormField
                control={form.control}
                name="returnMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">退货模式 *</FormLabel>
                    <Select
                      onValueChange={value => {
                        field.onChange(value);
                        // 切换模式时清空订单选择和明细
                        form.setValue('salesOrderId', '');
                        replace([]);
                        setSelectedSalesOrderId('');
                        setSelectedCustomerId('');
                        setProductInfoMap({});
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="请选择退货模式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RETURN_ORDER_MODE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              className="text-xs"
                            >
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              {returnMode === 'single_order' && (
                <FormItem>
                  <FormLabel className="text-xs">关联销售订单 *</FormLabel>
                  <FormControl>
                    <CustomerSalesOrderSelector
                      customers={customers}
                      salesOrders={salesOrders}
                      selectedCustomerId={selectedCustomerId}
                      value={form.watch('salesOrderId')}
                      onCustomerChange={customerId => {
                        setSelectedCustomerId(customerId);
                        form.setValue('customerId', customerId);
                        // 清空之前选择的订单
                        form.setValue('salesOrderId', '');
                        replace([]);
                        setProductInfoMap({});
                      }}
                      onValueChange={(salesOrderId, salesOrder) => {
                        setSelectedSalesOrderId(salesOrderId);
                        form.setValue('salesOrderId', salesOrderId);
                        form.setValue('customerId', salesOrder.customerId);
                        // 清空现有明细
                        replace([]);
                        setProductInfoMap({});
                        toast({
                          title: '已选择销售订单',
                          description: `订单号：${salesOrder.orderNumber}`,
                          variant: 'default',
                        });
                      }}
                      placeholder="选择客户和销售订单"
                      isLoadingCustomers={isLoadingCustomers}
                      isLoadingSalesOrders={isLoadingSalesOrders}
                      className="h-9"
                    />
                  </FormControl>
                  {form.formState.errors.salesOrderId && (
                    <p className="text-destructive text-xs">
                      {form.formState.errors.salesOrderId.message}
                    </p>
                  )}
                </FormItem>
              )}
              {returnMode === 'multi_order' && (
                <FormItem>
                  <FormLabel className="text-xs">客户选择 *</FormLabel>
                  <Select
                    onValueChange={value => {
                      setSelectedCustomerId(value);
                      form.setValue('customerId', value);
                      replace([]);
                      setProductInfoMap({});
                    }}
                    value={selectedCustomerId}
                  >
                    <FormControl>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="请选择客户" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem
                          key={customer.id}
                          value={customer.id}
                          className="text-xs"
                        >
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.customerId && (
                    <p className="text-destructive text-xs">
                      {form.formState.errors.customerId.message}
                    </p>
                  )}
                </FormItem>
              )}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">退货类型 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="请选择退货类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RETURN_ORDER_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              className="text-xs"
                            >
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="processType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">处理方式 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="请选择处理方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RETURN_PROCESS_TYPE_LABELS).map(
                          ([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              className="text-xs"
                            >
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-3">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">退货原因</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请详细描述退货原因（可选）"
                        className="min-h-16 text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <ReturnItemsSection
            form={form}
            fields={fields}
            onRemove={remove}
            onAddItem={handleAddEmptyItem}
            onSelectSalesOrderItem={handleMultiOrderItemSelect}
            isSubmitting={isLoading}
            isLoadingItems={isLoadingItems}
            selectedCustomerId={selectedCustomerId}
            returnMode={returnMode}
            productInfoMap={productInfoMap}
            calculateSubtotal={calculateSubtotal}
            calculateTotal={calculateTotal}
          />

          {/* 备注信息 */}
          <div className="bg-muted/5 border-b px-3 py-2">
            <div className="text-muted-foreground text-xs">
              备注信息（可选）
            </div>
          </div>
          <div className="px-3 py-3">
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息"
                      className="min-h-16 text-xs"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
    </div>
  );
}

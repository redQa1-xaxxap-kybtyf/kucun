/* eslint-disable max-lines-per-function, max-lines */
'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { CustomerSalesOrderSelector } from '@/components/return-orders/customer-sales-order-selector';
import {
    ReturnItemsSection,
    type ReturnOrderProductInfo,
    type ReturnOrderSelectableItem,
} from '@/components/return-orders/erp-return-order-form/ReturnItemsSection';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    RETURN_ORDER_MODE_LABELS,
    RETURN_ORDER_TYPE_LABELS,
    RETURN_PROCESS_TYPE_LABELS,
    type ReturnOrder,
} from '@/lib/types/return-order';
import {
    createReturnOrderDefaults,
    returnOrderFormSchema,
    type ReturnOrderFormData,
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
  // ✅ 修复：初始化时同步 initialData.customerId，确保编辑模式下客户下拉框显示已选客户
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialData?.customerId || ''
  );

  // ✅ 修复：使用 ref 标记是否为首次加载，避免编辑模式下清空原始明细
  const isInitialMount = useRef(true);

  // ✅ 表单设置 - 使用统一的 returnOrderFormSchema,避免联合类型问题
  const form = useForm<ReturnOrderFormData>({
    resolver: standardSchemaResolver(returnOrderFormSchema),
    defaultValues:
      mode === 'create'
        ? createReturnOrderDefaults
        : {
            id: initialData?.id,
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
                condition: item.condition || 'good',
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

  // ✅ 修复：监听 initialData.customerId 变化，同步到 selectedCustomerId
  useEffect(() => {
    if (initialData?.customerId) {
      setSelectedCustomerId(initialData.customerId);
    }
  }, [initialData?.customerId]);

  // 监听销售订单变化

  const returnMode =
    form.watch('returnMode') ??
    (initialData?.returnMode as 'single_order' | 'multi_order' | undefined) ??
    'single_order';
  const watchedSalesOrderId = form.watch('salesOrderId');
  useEffect(() => {
    // ✅ 修复：编辑模式首次加载时，跳过清空逻辑，保留原始明细
    if (isInitialMount.current && mode === 'edit' && initialData) {
      isInitialMount.current = false;
      return;
    }

    if (watchedSalesOrderId && watchedSalesOrderId !== selectedSalesOrderId) {
      setSelectedSalesOrderId(watchedSalesOrderId);
      // 清空现有明细（仅在用户主动切换订单时）
      replace([]);
      setProductInfoMap({});
    }
  }, [watchedSalesOrderId, selectedSalesOrderId, replace, mode, initialData]);

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
    // ✅ 修复：编辑模式首次加载时，跳过自动填充逻辑，保留原始明细
    if (mode === 'edit' && initialData && isInitialMount.current) {
      return;
    }

    if (
      returnableItemsData?.data?.returnableItems &&
      returnableItemsData.data.returnableItems.length > 0
    ) {
      // ✅ 修复：使用 salesOrderItemId 作为键，避免同一产品的不同订单被覆盖
      const newProductInfoMap: Record<string, ReturnOrderProductInfo> = {};
      returnableItemsData.data.returnableItems.forEach(item => {
        newProductInfoMap[item.salesOrderItemId] = {
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
  }, [returnableItemsData, replace, mode, initialData]);

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
      // ✅ 修复：使用 salesOrderItemId 作为键
      setProductInfoMap(prev => ({
        ...prev,
        [item.salesOrderItemId]: {
          ...item.productInfo,
          salesOrderNumber: item.salesOrderNumber,
        },
      }));
    },
    [append, setProductInfoMap]
  );

  // ✅ 表单提交 - 使用统一的 ReturnOrderFormData 类型
  const onSubmit = (data: ReturnOrderFormData) => {
    if (mode === 'edit' && initialData) {
      const updateData = {
        id: initialData.id,
        data: {
          id: initialData.id, // ✅ 使用 initialData.id 而非 data.id,确保类型正确
          returnMode: data.returnMode,
          salesOrderId: data.salesOrderId,
          customerId: data.customerId,
          type: data.type,
          processType: data.processType,
          reason: data.reason,
          remarks: data.remarks,
          items: data.items,
        },
      };
      updateMutation.mutate(updateData);
    } else {
      // 创建模式:移除 id 字段
      const { id: _id, ...createData } = data;
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
    <div className="space-y-4">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 w-8 rounded-full"
            onClick={handleCancel}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {mode === 'create' ? '新建退货订单' : '编辑退货订单'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === 'create' ? '填写退货信息' : '修改退货信息'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isLoading
              ? '保存中...'
              : mode === 'create'
                ? '创建退货订单'
                : '保存修改'}
          </Button>
        </div>
      </div>



      {/* 错误提示 */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {mode === 'create' ? '创建失败' : '更新失败'}: {error.message}
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">基本信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                <FormField
                  control={form.control}
                  name="returnMode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>退货模式 *</FormLabel>
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
                          <SelectTrigger>
                            <SelectValue placeholder="请选择退货模式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RETURN_ORDER_MODE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {returnMode === 'single_order' && (
                  <FormItem>
                    <FormLabel>关联销售订单 *</FormLabel>
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
                        className="h-10"
                      />
                    </FormControl>
                    {form.formState.errors.salesOrderId && (
                      <p className="text-destructive text-sm font-medium">
                        {form.formState.errors.salesOrderId.message}
                      </p>
                    )}
                  </FormItem>
                )}
                {returnMode === 'multi_order' && (
                  <FormItem>
                    <FormLabel>客户选择 *</FormLabel>
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
                        <SelectTrigger>
                          <SelectValue placeholder="请选择客户" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.customerId && (
                      <p className="text-destructive text-sm font-medium">
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
                      <FormLabel>退货类型 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择退货类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RETURN_ORDER_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="processType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>处理方式 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择处理方式" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(RETURN_PROCESS_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="mt-6">
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>退货原因</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请详细描述退货原因（可选）"
                          className="min-h-20 resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">备注信息</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入备注信息（可选）"
                        className="min-h-20 resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

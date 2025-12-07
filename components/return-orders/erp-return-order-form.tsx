/* eslint-disable max-lines-per-function, max-lines */
'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
  useUpdateReturnOrderStatus,
} from '@/lib/api/return-orders';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  RETURN_ORDER_MODE_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  type ReturnOrder,
} from '@/lib/types/return-order';
import {
  calculateReturnItemSubtotal,
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
  // 单订单模式下：用于展示“原始/已退/可退”数量提示（仅展示，不参与提交）
  const [returnableInfoMap, setReturnableInfoMap] = useState<
    Record<
      string,
      {
        originalQuantity: number;
        returnedQuantity: number;
        availableQuantity: number;
      }
    >
  >({});
  // 销售订单搜索词（用于后端搜索）
  const [salesOrderSearch, setSalesOrderSearch] = useState<string>('');

  // ✅ 表单设置 - 使用统一的 returnOrderFormSchema，避免联合类型 & resolver 类型不匹配问题
  const form = useForm<ReturnOrderFormData>({
    // standard-schema 当前的 TS 声明与我们基于 Zod 的 schema 类型存在差异，
    // 实际运行时行为是安全的，这里通过 any 进行适配，保持验证逻辑不变。
    resolver: (standardSchemaResolver as any)(returnOrderFormSchema) as any,
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
                // 为兼容历史数据，编辑模式下重新按「退货数量 - 破损数量」计算小计
                subtotal: calculateReturnItemSubtotal(
                  Math.max(
                    item.returnQuantity - (item.damagedQuantity || 0),
                    0
                  ),
                  item.unitPrice
                ),
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

  // 获取销售订单列表（根据选中的客户和搜索词筛选）
  // 后端搜索模式：支持按订单号、产品编码、产品名称、批次号搜索
  const { data: salesOrdersData, isLoading: isLoadingSalesOrders } = useQuery({
    queryKey: salesOrderQueryKeys.list({
      page: 1,
      limit: 50, // 减少每次加载数量
      customerId: selectedCustomerId || undefined,
      search: salesOrderSearch || undefined, // 传递搜索词给后端
    }),
    queryFn: () =>
      getSalesOrders({
        page: 1,
        limit: 50,
        customerId: selectedCustomerId || undefined,
        search: salesOrderSearch || undefined,
      }),
    // 只在选择客户后才加载订单
    enabled: Boolean(selectedCustomerId),
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

  // 获取可退货明细
  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(selectedSalesOrderId, {
      // 仅当用户在单订单模式下主动选择了销售订单时，才加载可退货明细
      enabled: !!selectedSalesOrderId && returnMode === 'single_order',
    });

  // 保存产品信息的状态，用于显示
  const [productInfoMap, setProductInfoMap] = useState<
    Record<string, ReturnOrderProductInfo>
  >({});

  // 编辑模式：根据初始数据构建产品信息映射，保证编辑时能看到产品名称/编码/规格等
  useEffect(() => {
    if (mode !== 'edit' || !initialData?.items) {
      return;
    }

    const map: Record<string, ReturnOrderProductInfo> = {};
    (initialData.items as any[]).forEach(item => {
      if (!item || !item.salesOrderItemId) return;
      const product = (item as any).product ?? {};
      const salesOrderItem = (item as any).salesOrderItem ?? {};
      map[item.salesOrderItemId] = {
        name: product.name ?? `产品`,
        code: product.code ?? '',
        unit: product.unit ?? '',
        specification: product.specification ?? null,
        batchNumber: salesOrderItem.batchNumber ?? null,
      };
    });

    setProductInfoMap(map);
  }, [mode, initialData]);

  // 当可退货明细加载完成后，自动填充到表单
  useEffect(() => {
    if (
      returnableItemsData?.data?.returnableItems &&
      returnableItemsData.data.returnableItems.length > 0
    ) {
      const items = returnableItemsData.data.returnableItems;

      // ✅ 使用 salesOrderItemId 作为键，避免同一产品的不同订单被覆盖
      const newProductInfoMap: Record<string, ReturnOrderProductInfo> = {};
      const newReturnableInfoMap: typeof returnableInfoMap = {};

      items.forEach(item => {
        newProductInfoMap[item.salesOrderItemId] = {
          name: item.product.name,
          code: item.product.code,
          // 单位优先使用销售订单行上的 displayUnit，其次回退到产品单位
          unit: (item as any).displayUnit ?? item.product.unit,
          specification: item.product.specification ?? null,
          batchNumber: item.batchNumber ?? null,
        };

        // 原始 / 已退 / 可退 数量仅用于前端展示，帮助销售识别多次退货
        newReturnableInfoMap[item.salesOrderItemId] = {
          originalQuantity: Number(item.originalQuantity ?? 0),
          returnedQuantity: Number(item.returnedQuantity ?? 0),
          availableQuantity: Number(item.availableQuantity ?? 0),
        };
      });

      setProductInfoMap(newProductInfoMap);
      setReturnableInfoMap(newReturnableInfoMap);

      // 将可退货明细转换为表单格式并填充
      const formItems = items.map(item => ({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        colorCode: item.colorCode || undefined,
        productionDate: item.productionDate || undefined,
        returnQuantity: 0, // 默认退货数量为0，用户需要手动填写
        damagedQuantity: 0,
        // ✅ 原始数量始终使用销售订单行的原始数量（例如 80 片），避免因为多次退货而“看起来在变小”
        originalQuantity: Number(item.originalQuantity ?? 0),
        unitPrice: item.unitPrice,
        subtotal: 0,
        reason: '',
        condition: 'good' as const, // 默认状态为良好
      }));

      replace(formItems);
    } else if (returnableItemsData?.data?.returnableItems?.length === 0) {
      replace([]);
      setProductInfoMap({});
      setReturnableInfoMap({});
    }
  }, [returnableItemsData, replace, mode, initialData]);

  // 状态更新：用于“提交退货订单”（草稿 -> 已提交）
  const updateStatusMutation = useUpdateReturnOrderStatus({
    onSuccess: response => {
      toast({
        title: '提交成功',
        description: `退货订单 ${response.data.returnNumber} 已提交审核`,
        variant: 'success',
      });
    },
    onError: error => {
      toast({
        title: '提交失败',
        description: error.message || '提交退货订单时发生错误',
        variant: 'destructive',
      });
    },
  });

  // 创建 / 更新 Mutations
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

  // 计算明细小计（破损数量不计入应退款金额）
  const calculateSubtotal = (index: number) => {
    const quantity = form.watch(`items.${index}.returnQuantity`);
    const damaged = form.watch(`items.${index}.damagedQuantity`) ?? 0;
    const unitPrice = form.watch(`items.${index}.unitPrice`);
    const effectiveQuantity = Math.max((quantity ?? 0) - (damaged ?? 0), 0);
    const subtotal = calculateReturnItemSubtotal(effectiveQuantity, unitPrice);
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
        subtotal:
          item.subtotal ??
          calculateReturnItemSubtotal(
            Math.max(item.returnQuantity - (item.damagedQuantity ?? 0), 0),
            item.unitPrice
          ),
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

  // ✅ 表单提交（仅保存，不改变状态 -> 草稿）
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

  // ✅ 提交退货订单：保存后立即将状态改为 submitted
  const onSubmitAndSubmit = (data: ReturnOrderFormData) => {
    if (mode === 'edit' && initialData) {
      const updateData = {
        id: initialData.id,
        data: {
          id: initialData.id,
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

      updateMutation.mutate(updateData, {
        onSuccess: response => {
          updateStatusMutation.mutate({
            id: response.data.id,
            status: 'submitted',
          });
        },
      });
    } else {
      const { id: _id, ...createData } = data;
      createMutation.mutate(createData, {
        onSuccess: response => {
          updateStatusMutation.mutate({
            id: response.data.id,
            status: 'submitted',
          });
        },
      });
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

  const isLoading =
    createMutation.isPending ||
    updateMutation.isPending ||
    updateStatusMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="space-y-4">
      {/* 顶部导航栏 */}
      <div className="bg-card flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm">
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
            <p className="text-muted-foreground text-sm">
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
            variant="outline"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {mode === 'create' || initialData?.status === 'draft'
              ? '保存草稿'
              : '保存修改'}
          </Button>
          {(mode === 'create' || initialData?.status === 'draft') && (
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmitAndSubmit)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              提交退货订单
            </Button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
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
                          // 清空之前选择的订单和搜索词
                          form.setValue('salesOrderId', '');
                          setSalesOrderSearch('');
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
                        onSearchChange={search => {
                          setSalesOrderSearch(search);
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
            returnableInfoMap={returnableInfoMap}
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

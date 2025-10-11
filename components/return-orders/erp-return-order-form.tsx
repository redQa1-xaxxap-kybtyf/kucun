'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Package,
  Save,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { CustomerSalesOrderSelector } from '@/components/return-orders/customer-sales-order-selector';
import { MultiOrderItemSelector } from '@/components/return-orders/multi-order-item-selector';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getSalesOrders, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateReturnOrder,
  useSalesOrderReturnableItems,
  useUpdateReturnOrder,
} from '@/lib/api/return-orders';
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
                originalQuantity: item.originalQuantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                condition: item.condition,
                reason: item.reason,
              })) || [],
          },
  });

  const { fields, append, remove } = useFieldArray({
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
  const customers = Array.isArray(customersData?.data) ? customersData.data : [];
  const salesOrders = Array.isArray(salesOrdersData?.data)
    ? salesOrdersData.data
    : [];

  // 监听销售订单变化
  const watchedSalesOrderId = form.watch('salesOrderId');
  useEffect(() => {
    if (watchedSalesOrderId && watchedSalesOrderId !== selectedSalesOrderId) {
      setSelectedSalesOrderId(watchedSalesOrderId);
      // 清空现有明细
      form.setValue('items', []);
    }
  }, [watchedSalesOrderId, selectedSalesOrderId, form]);

  // 获取可退货明细
  const { data: returnableItemsData, isLoading: isLoadingItems } =
    useSalesOrderReturnableItems(selectedSalesOrderId, {
      enabled: !!selectedSalesOrderId,
    });

  // 保存产品信息的状态，用于显示
  const [productInfoMap, setProductInfoMap] = useState<
    Record<
      string,
      {
        name: string;
        code: string;
        unit: string;
        specification: string | null;
        salesOrderNumber?: string; // 多订单模式下记录来源订单号
      }
    >
  >({});

  // 当可退货明细加载完成后，自动填充到表单
  useEffect(() => {
    if (
      returnableItemsData?.data?.returnableItems &&
      returnableItemsData.data.returnableItems.length > 0
    ) {
      // 清空现有明细
      form.setValue('items', []);

      // 构建产品信息映射
      const newProductInfoMap: Record<
        string,
        {
          name: string;
          code: string;
          unit: string;
          specification: string | null;
        }
      > = {};
      returnableItemsData.data.returnableItems.forEach(item => {
        newProductInfoMap[item.productId] = item.product;
      });
      setProductInfoMap(newProductInfoMap);

      // 将可退货明细转换为表单格式并填充
      const formItems = returnableItemsData.data.returnableItems.map(item => ({
        salesOrderItemId: item.salesOrderItemId,
        productId: item.productId,
        colorCode: item.colorCode || undefined,
        productionDate: item.productionDate || undefined,
        returnQuantity: 0, // 默认退货数量为0，用户需要手动填写
        originalQuantity: item.availableQuantity,
        unitPrice: item.unitPrice,
        subtotal: 0,
        reason: '',
        condition: 'good' as const,
      }));

      form.setValue('items', formItems);
    }
  }, [returnableItemsData, form]);

  // Mutations
  const createMutation = useCreateReturnOrder({
    onSuccess: response => {
      toast({
        title: '创建成功',
        description: `退货订单 ${response.data.returnNumber} 已创建`,
        variant: 'default',
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
        variant: 'default',
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

  // 添加退货明细
  const _addReturnItem = (salesOrderItem: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: number;
  }) => {
    const newItem = {
      salesOrderItemId: salesOrderItem.id,
      productId: salesOrderItem.productId,
      returnQuantity: 1,
      originalQuantity: salesOrderItem.quantity,
      unitPrice: salesOrderItem.unitPrice,
      subtotal: salesOrderItem.unitPrice,
      condition: 'good' as const,
    };
    append(newItem);
  };

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
                        form.setValue('items', []);
                        setSelectedSalesOrderId('');
                        setSelectedCustomerId('');
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
              {form.watch('returnMode') === 'single_order' && (
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
                        form.setValue('items', []);
                      }}
                      onValueChange={(salesOrderId, salesOrder) => {
                        setSelectedSalesOrderId(salesOrderId);
                        form.setValue('salesOrderId', salesOrderId);
                        form.setValue('customerId', salesOrder.customerId);
                        // 清空现有明细
                        form.setValue('items', []);
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
              {form.watch('returnMode') === 'multi_order' && (
                <FormItem>
                  <FormLabel className="text-xs">客户选择 *</FormLabel>
                  <Select
                    onValueChange={value => {
                      setSelectedCustomerId(value);
                      form.setValue('customerId', value);
                      form.setValue('items', []);
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

          {/* 退货明细 */}
          <div className="bg-muted/5 border-b px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-xs">退货明细</div>
              <div className="text-muted-foreground text-xs">
                总金额: ¥{calculateTotal().toFixed(2)}
              </div>
            </div>
          </div>
          <div className="px-3 py-3">
            {/* 多订单模式：显示商品选择器 */}
            {form.watch('returnMode') === 'multi_order' &&
              selectedCustomerId && (
                <div className="mb-4">
                  <div className="mb-2 text-xs font-medium">
                    从销售订单中选择退货商品
                  </div>
                  <MultiOrderItemSelector
                    customerId={selectedCustomerId}
                    onItemSelect={item => {
                      // 添加到表单明细
                      const newItem = {
                        salesOrderItemId: item.salesOrderItemId,
                        productId: item.productId,
                        colorCode: item.colorCode,
                        productionDate: item.productionDate,
                        returnQuantity: item.returnQuantity,
                        originalQuantity: item.originalQuantity,
                        unitPrice: item.unitPrice,
                        subtotal: item.subtotal,
                        condition: item.condition,
                        reason: item.reason,
                      };
                      append(newItem);

                      // 记录产品信息和来源订单号
                      setProductInfoMap(prev => ({
                        ...prev,
                        [item.productId]: {
                          ...item.productInfo,
                          salesOrderNumber: item.salesOrderNumber,
                        },
                      }));
                    }}
                    selectedItems={fields.map(f => f.salesOrderItemId)}
                  />
                </div>
              )}

            {/* 单订单模式：显示加载状态 */}
            {form.watch('returnMode') === 'single_order' && isLoadingItems && (
              <div className="flex items-center justify-center gap-2 py-8">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-muted-foreground text-xs">
                  加载销售订单明细中...
                </span>
              </div>
            )}

            {/* 空状态提示 */}
            {fields.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center text-xs">
                {form.watch('returnMode') === 'single_order'
                  ? '暂无退货明细，请先选择销售订单'
                  : '暂无退货明细，请从上方选择要退货的商品'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-8 px-2">产品</TableHead>
                      {form.watch('returnMode') === 'multi_order' && (
                        <TableHead className="h-8 px-2">来源订单</TableHead>
                      )}
                      <TableHead className="h-8 px-2">原始数量</TableHead>
                      <TableHead className="h-8 px-2">退货数量</TableHead>
                      <TableHead className="h-8 px-2">单价</TableHead>
                      <TableHead className="h-8 px-2">小计</TableHead>
                      <TableHead className="h-8 px-2">商品状态</TableHead>
                      <TableHead className="h-8 px-2 text-center">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id} className="text-xs">
                        <TableCell className="h-8 px-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Package className="text-muted-foreground h-3 w-3" />
                              <span className="font-medium">
                                {productInfoMap[field.productId]?.name ||
                                  `产品 ${index + 1}`}
                              </span>
                            </div>
                            {productInfoMap[field.productId] && (
                              <div className="text-muted-foreground flex gap-2 text-xs">
                                <span>
                                  {productInfoMap[field.productId].code}
                                </span>
                                {productInfoMap[field.productId]
                                  .specification && (
                                  <span>
                                    {
                                      productInfoMap[field.productId]
                                        .specification
                                    }
                                  </span>
                                )}
                                {field.colorCode && (
                                  <span>颜色: {field.colorCode}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        {form.watch('returnMode') === 'multi_order' && (
                          <TableCell className="h-8 px-2">
                            <span className="text-muted-foreground font-mono text-xs">
                              {productInfoMap[field.productId]?.salesOrderNumber ||
                                '-'}
                            </span>
                          </TableCell>
                        )}
                        <TableCell className="h-8 px-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.originalQuantity`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                className="h-6 w-20 text-xs"
                                readOnly
                                {...field}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.returnQuantity`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                min="1"
                                className="h-6 w-16 text-xs"
                                {...field}
                                onChange={e => {
                                  field.onChange(Number(e.target.value));
                                  calculateSubtotal(index);
                                }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                step="0.01"
                                className="h-6 w-20 text-xs"
                                {...field}
                                onChange={e => {
                                  field.onChange(Number(e.target.value));
                                  calculateSubtotal(index);
                                }}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <span className="font-mono text-xs">
                            ¥
                            {form
                              .watch(`items.${index}.subtotal`)
                              ?.toFixed(2) || '0.00'}
                          </span>
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.condition`}
                            render={({ field }) => (
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <SelectTrigger className="h-6 w-20 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="good" className="text-xs">
                                    完好
                                  </SelectItem>
                                  <SelectItem
                                    value="damaged"
                                    className="text-xs"
                                  >
                                    损坏
                                  </SelectItem>
                                  <SelectItem
                                    value="defective"
                                    className="text-xs"
                                  >
                                    缺陷
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

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

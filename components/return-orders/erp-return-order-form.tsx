'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Loader2,
  Package,
  Save,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import {
  useCreateReturnOrder,
  useSalesOrderReturnableItems,
  useUpdateReturnOrder,
} from '@/lib/api/return-orders';
import {
  type ReturnOrder,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
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
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string>('');
  const [salesOrderNumber, setSalesOrderNumber] = useState<string>('');
  const [isSearchingSalesOrder, setIsSearchingSalesOrder] = useState(false);

  // 表单设置
  const form = useForm<CreateReturnOrderFormData | UpdateReturnOrderFormData>({
    resolver: zodResolver(
      mode === 'create' ? createReturnOrderSchema : updateReturnOrderSchema
    ),
    defaultValues:
      mode === 'create'
        ? createReturnOrderDefaults
        : {
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

  // 根据订单号查询销售订单
  const searchSalesOrderByNumber = async (orderNumber: string) => {
    if (!orderNumber.trim()) return;

    setIsSearchingSalesOrder(true);
    try {
      const response = await fetch(
        `/api/sales-orders?search=${encodeURIComponent(orderNumber)}&limit=1`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // 包含cookies以传递会话信息
        }
      );
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data?.length > 0) {
          const order = result.data[0];
          if (order.orderNumber === orderNumber) {
            setSelectedSalesOrderId(order.id);
            form.setValue('salesOrderId', order.id);
            // 清空现有明细
            form.setValue('items', []);
            toast.success(`已找到销售订单：${order.orderNumber}`);
          } else {
            toast.error('未找到匹配的销售订单');
          }
        } else {
          toast.error('未找到销售订单');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || '查询销售订单失败');
      }
    } catch (error) {
      console.error('查询销售订单失败:', error);
      toast.error('查询销售订单失败');
    } finally {
      setIsSearchingSalesOrder(false);
    }
  };

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
  const { data: _returnableItemsData, isLoading: _isLoadingItems } =
    useSalesOrderReturnableItems(selectedSalesOrderId, {
      enabled: !!selectedSalesOrderId,
    });

  // Mutations
  const createMutation = useCreateReturnOrder({
    onSuccess: response => {
      onSuccess?.(response.data);
    },
  });

  const updateMutation = useUpdateReturnOrder({
    onSuccess: response => {
      onSuccess?.(response.data);
    },
  });

  // 添加退货明细
  const _addReturnItem = (salesOrderItem: any) => {
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
    return items.reduce((total, item) => total + (item.subtotal || 0), 0);
  };

  // 表单提交
  const onSubmit = (
    data: CreateReturnOrderFormData | UpdateReturnOrderFormData
  ) => {
    if (mode === 'edit' && initialData) {
      const updateData: UpdateReturnOrderFormData = {
        id: initialData.id,
        ...data,
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
    <div className="rounded border bg-card">
      {/* ERP标准工具栏 */}
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            {mode === 'create' ? '新建退货订单' : '编辑退货订单'}
          </h3>
          <div className="text-xs text-muted-foreground">
            {mode === 'create' ? '填写退货信息' : '修改退货信息'}
          </div>
        </div>
      </div>

      {/* 操作工具栏 */}
      <div className="border-b bg-muted/10 px-3 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
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
          <div className="border-b bg-muted/5 px-3 py-2">
            <div className="text-xs text-muted-foreground">基本信息</div>
          </div>
          <div className="px-3 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <FormItem>
                <FormLabel className="text-xs">关联销售订单 *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <ShoppingCart className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="请输入销售订单号"
                      className="h-7 pl-7 text-xs"
                      value={salesOrderNumber}
                      onChange={e => setSalesOrderNumber(e.target.value)}
                      onBlur={() => {
                        if (salesOrderNumber.trim()) {
                          searchSalesOrderByNumber(salesOrderNumber.trim());
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (salesOrderNumber.trim()) {
                            searchSalesOrderByNumber(salesOrderNumber.trim());
                          }
                        }
                      }}
                      disabled={isSearchingSalesOrder}
                    />
                    {isSearchingSalesOrder && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      </div>
                    )}
                  </div>
                </FormControl>
                {form.formState.errors.salesOrderId && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.salesOrderId.message}
                  </p>
                )}
              </FormItem>
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
                    <FormLabel className="text-xs">退货原因 *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请详细描述退货原因"
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
          <div className="border-b bg-muted/5 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">退货明细</div>
              <div className="text-xs text-muted-foreground">
                总金额: ¥{calculateTotal().toFixed(2)}
              </div>
            </div>
          </div>
          <div className="px-3 py-3">
            {fields.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                暂无退货明细，请先选择销售订单
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="h-8 px-2">产品</TableHead>
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
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            <span>产品 {index + 1}</span>
                          </div>
                        </TableCell>
                        <TableCell className="h-8 px-2">
                          <FormField
                            control={form.control}
                            name={`items.${index}.originalQuantity`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                className="h-6 w-16 text-xs"
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
          <div className="border-b bg-muted/5 px-3 py-2">
            <div className="text-xs text-muted-foreground">
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

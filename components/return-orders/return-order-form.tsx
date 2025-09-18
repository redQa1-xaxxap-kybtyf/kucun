'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
    AlertCircle,
    ArrowLeft,
    Calculator,
    Package,
    Plus,
    Search,
    ShoppingCart,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

// UI Components
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

// Icons

// API and Types
import {
    useCreateReturnOrder,
    useSalesOrderReturnableItems,
    useUpdateReturnOrder,
} from '@/lib/api/return-orders';
import type { ReturnOrder } from '@/lib/types/return-order';
import {
    RETURN_ORDER_TYPE_LABELS,
    RETURN_PROCESS_TYPE_LABELS,
    calculateReturnItemsTotal,
    formatReturnAmount,
} from '@/lib/types/return-order';
import type {
    CreateReturnOrderFormData,
    UpdateReturnOrderFormData
} from '@/lib/validations/return-order';
import {
    calculateReturnItemSubtotal,
    createReturnOrderDefaults,
    createReturnOrderSchema,
    updateReturnOrderSchema,
} from '@/lib/validations/return-order';

interface ReturnOrderFormProps {
  mode: 'create' | 'edit';
  initialData?: ReturnOrder;
  onSuccess?: (result: ReturnOrder) => void;
  onCancel?: () => void;
}

export function ReturnOrderForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: ReturnOrderFormProps) {
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState<string>('');

  // 表单设置
  const form = useForm<CreateReturnOrderFormData | UpdateReturnOrderFormData>({
    resolver: zodResolver(
      mode === 'create' ? createReturnOrderSchema : updateReturnOrderSchema
    ),
    defaultValues:
      mode === 'create'
        ? createReturnOrderDefaults
        : {
            ...initialData,
            items:
              initialData?.items?.map(item => ({
                id: item.id,
                salesOrderItemId: item.salesOrderItemId,
                productId: item.productId,
                returnQuantity: item.returnQuantity,
                originalQuantity: item.originalQuantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                reason: item.reason,
                condition: item.condition,
              })) || [],
          },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

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
  const addReturnItem = (salesOrderItem: any) => {
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
    const subtotal = calculateReturnItemSubtotal(quantity, unitPrice);
    form.setValue(`items.${index}.subtotal`, subtotal);
  };

  // 计算总金额
  const items = form.watch('items');
  const totalAmount = calculateReturnItemsTotal(items as any || []);

  // 提交表单
  const onSubmit = (
    data: CreateReturnOrderFormData | UpdateReturnOrderFormData
  ) => {
    if (mode === 'create') {
      createMutation.mutate(data as CreateReturnOrderFormData);
    } else {
      updateMutation.mutate({
        id: initialData!.id,
        data: data as UpdateReturnOrderFormData,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center space-x-4">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
        )}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === 'create' ? '创建退货订单' : '编辑退货订单'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'create'
              ? '填写退货信息并添加退货明细'
              : '修改退货订单信息'}
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error.message}</AlertDescription>
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
              <CardDescription>填写退货订单的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 销售订单选择 */}
                <FormField
                  control={form.control}
                  name="salesOrderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>关联销售订单 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={mode === 'edit'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择销售订单" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">请选择销售订单</SelectItem>
                          {/* 这里应该显示销售订单列表，简化处理 */}
                          <SelectItem value="sales-order-1">
                            SO202501160001
                          </SelectItem>
                          <SelectItem value="sales-order-2">
                            SO202501160002
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 退货类型 */}
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>退货类型 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择退货类型" />
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

                {/* 处理方式 */}
                <FormField
                  control={form.control}
                  name="processType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>处理方式 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择处理方式" />
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

              {/* 退货原因 */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退货原因 *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请详细描述退货原因..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 备注 */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea placeholder="其他备注信息..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 退货明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    退货明细
                  </CardTitle>
                  <CardDescription>选择要退货的商品明细</CardDescription>
                </div>
                {selectedSalesOrderId && (
                  <div className="text-sm text-muted-foreground">
                    已选择 {fields.length} 个明细项目
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedSalesOrderId ? (
                <div className="py-8 text-center">
                  <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">请先选择销售订单</p>
                </div>
              ) : isLoadingItems ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
                  <p className="text-muted-foreground">加载可退货明细中...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 可选择的销售订单明细 */}
                  {returnableItemsData?.data &&
                    returnableItemsData.data.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">
                          可退货明细
                        </Label>
                        <div className="mt-2 space-y-2">
                          {returnableItemsData.data.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div className="flex-1">
                                <div className="font-medium">
                                  {item.product?.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  数量: {item.quantity} {item.product?.unit} |
                                  单价: {formatReturnAmount(item.unitPrice)}
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addReturnItem(item)}
                                disabled={fields.some(
                                  field => field.salesOrderItemId === item.id
                                )}
                              >
                                <Plus className="mr-1 h-4 w-4" />
                                添加
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {fields.length > 0 && (
                    <>
                      <Separator />

                      {/* 已选择的退货明细 */}
                      <div>
                        <Label className="text-sm font-medium">退货明细</Label>
                        <div className="mt-2">
                          {/* 桌面端表格 */}
                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>产品</TableHead>
                                  <TableHead>色号</TableHead>
                                  <TableHead>退货数量</TableHead>
                                  <TableHead>单价</TableHead>
                                  <TableHead>小计</TableHead>
                                  <TableHead>商品状态</TableHead>
                                  <TableHead>操作</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {fields.map((field, index) => (
                                  <TableRow key={field.id}>
                                    <TableCell>
                                      <div className="font-medium">
                                        产品名称
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        产品编码
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.returnQuantity`}
                                        render={({ field: quantityField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                className="w-24"
                                                {...quantityField}
                                                onChange={e => {
                                                  quantityField.onChange(
                                                    parseFloat(
                                                      e.target.value
                                                    ) || 0
                                                  );
                                                  calculateSubtotal(index);
                                                }}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-medium">
                                        {formatReturnAmount(field.unitPrice)}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span className="font-medium">
                                        {formatReturnAmount(field.subtotal)}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.condition`}
                                        render={({ field: conditionField }) => (
                                          <FormItem>
                                            <Select
                                              onValueChange={
                                                conditionField.onChange
                                              }
                                              value={conditionField.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger className="w-24">
                                                  <SelectValue />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="good">
                                                  完好
                                                </SelectItem>
                                                <SelectItem value="damaged">
                                                  损坏
                                                </SelectItem>
                                                <SelectItem value="defective">
                                                  缺陷
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => remove(index)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* 移动端卡片 */}
                          <div className="space-y-4 md:hidden">
                            {fields.map((field, index) => (
                              <Card key={field.id} className="border-muted">
                                <CardContent className="p-4">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="font-medium">产品名称</div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => remove(index)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <Label>退货数量</Label>
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.returnQuantity`}
                                        render={({ field: quantityField }) => (
                                          <FormItem>
                                            <FormControl>
                                              <Input
                                                type="number"
                                                min="0.01"
                                                step="0.01"
                                                {...quantityField}
                                                onChange={e => {
                                                  quantityField.onChange(
                                                    parseFloat(
                                                      e.target.value
                                                    ) || 0
                                                  );
                                                  calculateSubtotal(index);
                                                }}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                    <div>
                                      <Label>商品状态</Label>
                                      <FormField
                                        control={form.control}
                                        name={`items.${index}.condition`}
                                        render={({ field: conditionField }) => (
                                          <FormItem>
                                            <Select
                                              onValueChange={
                                                conditionField.onChange
                                              }
                                              value={conditionField.value}
                                            >
                                              <FormControl>
                                                <SelectTrigger>
                                                  <SelectValue />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="good">
                                                  完好
                                                </SelectItem>
                                                <SelectItem value="damaged">
                                                  损坏
                                                </SelectItem>
                                                <SelectItem value="defective">
                                                  缺陷
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                                    <span className="text-muted-foreground">
                                      小计:
                                    </span>
                                    <span className="font-medium">
                                      {formatReturnAmount(field.subtotal)}
                                    </span>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>

                          {/* 总计 */}
                          <Separator />
                          <div className="flex items-center justify-between pt-4">
                            <div className="flex items-center space-x-2">
                              <Calculator className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">
                                共 {fields.length} 个明细项目
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold">
                                {formatReturnAmount(totalAmount)}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                退货总金额
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {fields.length === 0 && selectedSalesOrderId && (
                    <div className="py-8 text-center">
                      <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">请添加退货明细</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
            <Button type="submit" disabled={isLoading || fields.length === 0}>
              {isLoading
                ? '保存中...'
                : mode === 'create'
                  ? '创建退货订单'
                  : '保存修改'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

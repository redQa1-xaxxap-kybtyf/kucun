'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    Calculator,
    Calendar,
    Loader2,
    Package,
    Plus,
    Save,
    ShoppingCart,
    Trash2
} from 'lucide-react';
import { useState } from 'react';

// UI Components
import { useFieldArray, useForm } from 'react-hook-form';

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
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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

// Custom Components

// API and Types
import {
    createPurchaseOrder,
    getSuppliers,
    purchaseOrderQueryKeys,
    updatePurchaseOrder,
} from '@/lib/api/purchase-orders';
import type { PurchaseOrder } from '@/lib/types/purchase-order';
import { COMMON_COLOR_CODES } from '@/lib/types/purchase-order';
import type {
    PurchaseOrderCreateFormData,
    PurchaseOrderUpdateFormData
} from '@/lib/validations/purchase-order';
import {
    calculateOrderTotal,
    purchaseOrderCreateDefaults,
    purchaseOrderCreateSchema,
    purchaseOrderUpdateDefaults,
    purchaseOrderUpdateSchema,
} from '@/lib/validations/purchase-order';

import { ProductSelector } from '@/components/products/product-selector';

interface PurchaseOrderFormProps {
  mode: 'create' | 'edit';
  initialData?: PurchaseOrder;
  onSuccess?: (result: PurchaseOrder) => void;
  onCancel?: () => void;
}

export function PurchaseOrderForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: PurchaseOrderFormProps) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const isEdit = mode === 'edit';
  const schema = isEdit ? purchaseOrderUpdateSchema : purchaseOrderCreateSchema;
  const defaults = isEdit
    ? ({
        ...purchaseOrderUpdateDefaults,
        supplierId: initialData?.supplierId || '',
        expectedDeliveryDate: initialData?.expectedDeliveryDate || '',
        remarks: initialData?.remarks || '',
        items:
          initialData?.items?.map(item => ({
            id: item.id,
            productId: item.productId,
            colorCode: item.colorCode || '',
            productionDate: item.productionDate || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })) || [],
      } as PurchaseOrderUpdateFormData)
    : purchaseOrderCreateDefaults;

  const form = useForm<
    PurchaseOrderCreateFormData | PurchaseOrderUpdateFormData
  >({
    resolver: zodResolver(schema),
    defaultValues: defaults as any,
  });

  // 明细项目管理
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 监听表单变化计算总金额
  const watchedItems = form.watch('items');
  const totalAmount = calculateOrderTotal(watchedItems || []);

  // 获取供应商列表
  const { data: suppliersData } = useQuery({
    queryKey: purchaseOrderQueryKeys.suppliersList(),
    queryFn: () => getSuppliers(),
  });

  // 创建 Mutation
  const createMutation = useMutation({
    mutationFn: createPurchaseOrder,
    onSuccess: response => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderQueryKeys.lists(),
      });
      if (onSuccess) {
        onSuccess(response.data);
      }
    },
    onError: error => {
      setSubmitError(
        error instanceof Error ? error.message : '创建采购订单失败'
      );
    },
  });

  // 更新 Mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: PurchaseOrderUpdateFormData;
    }) => updatePurchaseOrder(id, data),
    onSuccess: response => {
      queryClient.invalidateQueries({
        queryKey: purchaseOrderQueryKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: purchaseOrderQueryKeys.detail(initialData!.id),
      });
      if (onSuccess) {
        onSuccess(response.data);
      }
    },
    onError: error => {
      setSubmitError(
        error instanceof Error ? error.message : '更新采购订单失败'
      );
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  // 表单提交
  const onSubmit = async (data: any) => {
    setSubmitError('');

    try {
      if (isEdit && initialData) {
        await updateMutation.mutateAsync({ id: initialData.id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
    } catch (error) {
      // 错误已在 mutation 的 onError 中处理
    }
  };

  // 添加明细项目
  const addItem = () => {
    append({
      productId: '',
      colorCode: '',
      productionDate: '',
      quantity: 1,
      unitPrice: 0,
    });
  };

  // 删除明细项目
  const removeItem = (index: number) => {
    remove(index);
  };

  // 计算明细小计
  const calculateItemSubtotal = (quantity: number, unitPrice: number) => quantity * unitPrice;

  const suppliers = suppliersData?.data || [];

  return (
    <div className="container mx-auto space-y-6 py-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          )}
          <div>
            <h1 className="flex items-center text-3xl font-bold tracking-tight">
              <ShoppingCart className="mr-3 h-8 w-8" />
              {isEdit ? '编辑采购订单' : '创建采购订单'}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? '修改采购订单信息和明细' : '创建新的采购订单'}
            </p>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="mr-2 h-5 w-5" />
                基础信息
              </CardTitle>
              <CardDescription>填写采购订单的基本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 供应商选择 */}
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应商 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择供应商" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map(supplier => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              <div className="flex w-full items-center justify-between">
                                <span>{supplier.name}</span>
                                {supplier.status === 'inactive' && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-2 text-xs"
                                  >
                                    已停用
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 预期交货日期 */}
                <FormField
                  control={form.control}
                  name="expectedDeliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        预期交货日期
                      </FormLabel>
                      <FormControl>
                        <Input type="date" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 备注 */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="采购订单备注信息..."
                        className="min-h-[80px]"
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 采购明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Package className="mr-2 h-5 w-5" />
                    采购明细
                  </CardTitle>
                  <CardDescription>添加采购的产品和数量信息</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                  disabled={isLoading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  添加明细
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="py-8 text-center">
                  <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-medium">暂无采购明细</h3>
                  <p className="mb-4 text-muted-foreground">
                    请添加需要采购的产品
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addItem}
                    disabled={isLoading}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    添加第一个明细
                  </Button>
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">产品</TableHead>
                          <TableHead className="w-[120px]">色号</TableHead>
                          <TableHead className="w-[140px]">生产日期</TableHead>
                          <TableHead className="w-[100px]">数量</TableHead>
                          <TableHead className="w-[120px]">单价</TableHead>
                          <TableHead className="w-[120px]">小计</TableHead>
                          <TableHead className="w-[80px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((field, index) => {
                          const quantity =
                            form.watch(`items.${index}.quantity`) || 0;
                          const unitPrice =
                            form.watch(`items.${index}.unitPrice`) || 0;
                          const subtotal = calculateItemSubtotal(
                            quantity,
                            unitPrice
                          );

                          return (
                            <TableRow key={field.id}>
                              <TableCell>
                                <ProductSelector
                                  control={form.control}
                                  name={`items.${index}.productId`}
                                  placeholder="选择产品..."
                                  disabled={isLoading}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.colorCode`}
                                  render={({ field }) => (
                                    <Select
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      disabled={isLoading}
                                    >
                                      <SelectTrigger className="w-full">
                                        <SelectValue placeholder="色号" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">
                                          无色号
                                        </SelectItem>
                                        {COMMON_COLOR_CODES.map(color => (
                                          <SelectItem
                                            key={color.value}
                                            value={color.value}
                                          >
                                            {color.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.productionDate`}
                                  render={({ field }) => (
                                    <Input
                                      type="date"
                                      disabled={isLoading}
                                      {...field}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      min="1"
                                      max="999999"
                                      disabled={isLoading}
                                      {...field}
                                      onChange={e => {
                                        const value = e.target.value;
                                        field.onChange(
                                          value ? parseInt(value) : 0
                                        );
                                      }}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unitPrice`}
                                  render={({ field }) => (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="999999.99"
                                      disabled={isLoading}
                                      {...field}
                                      onChange={e => {
                                        const value = e.target.value;
                                        field.onChange(
                                          value ? parseFloat(value) : 0
                                        );
                                      }}
                                    />
                                  )}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="font-medium">
                                  ¥
                                  {subtotal.toLocaleString('zh-CN', {
                                    minimumFractionDigits: 2,
                                  })}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => removeItem(index)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="space-y-4 md:hidden">
                    {fields.map((field, index) => {
                      const quantity =
                        form.watch(`items.${index}.quantity`) || 0;
                      const unitPrice =
                        form.watch(`items.${index}.unitPrice`) || 0;
                      const subtotal = calculateItemSubtotal(
                        quantity,
                        unitPrice
                      );

                      return (
                        <Card key={field.id} className="border-muted">
                          <CardContent className="p-4">
                            <div className="mb-3 flex items-center justify-between">
                              <h4 className="font-medium">明细 #{index + 1}</h4>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeItem(index)}
                                disabled={isLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>

                            <div className="space-y-3">
                              <ProductSelector
                                control={form.control}
                                name={`items.${index}.productId`}
                                label="产品"
                                placeholder="选择产品..."
                                disabled={isLoading}
                              />

                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.colorCode`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>色号</FormLabel>
                                      <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        disabled={isLoading}
                                      >
                                        <FormControl>
                                          <SelectTrigger>
                                            <SelectValue placeholder="色号" />
                                          </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                          <SelectItem value="none">
                                            无色号
                                          </SelectItem>
                                          {COMMON_COLOR_CODES.map(color => (
                                            <SelectItem
                                              key={color.value}
                                              value={color.value}
                                            >
                                              {color.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`items.${index}.productionDate`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>生产日期</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="date"
                                          disabled={isLoading}
                                          {...field}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.quantity`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>数量</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="1"
                                          max="999999"
                                          disabled={isLoading}
                                          {...field}
                                          onChange={e => {
                                            const value = e.target.value;
                                            field.onChange(
                                              value ? parseInt(value) : 0
                                            );
                                          }}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unitPrice`}
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>单价</FormLabel>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max="999999.99"
                                          disabled={isLoading}
                                          {...field}
                                          onChange={e => {
                                            const value = e.target.value;
                                            field.onChange(
                                              value ? parseFloat(value) : 0
                                            );
                                          }}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>

                              <div className="border-t pt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">
                                    小计:
                                  </span>
                                  <span className="font-medium">
                                    ¥
                                    {subtotal.toLocaleString('zh-CN', {
                                      minimumFractionDigits: 2,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* 总计 */}
                  <Separator />
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-muted-foreground">
                        共 {fields.length} 个明细项目
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-bold">
                        总金额: ¥
                        {totalAmount.toLocaleString('zh-CN', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end space-x-4">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                取消
              </Button>
            )}
            <Button type="submit" disabled={isLoading || fields.length === 0}>
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

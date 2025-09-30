'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  CalendarIcon,
  DollarSign,
  Minus,
  Package,
  Plus,
  Save,
  Truck,
} from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { SupplierPriceSelector } from '@/components/factory-shipments/supplier-price-selector';
import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import {
  getLatestPrice,
  useCustomerPriceHistory,
} from '@/hooks/use-price-history';
import { getCustomers } from '@/lib/api/customers';
import { getProducts } from '@/lib/api/products';
import { getSuppliers } from '@/lib/api/suppliers';
import { factoryShipmentConfig } from '@/lib/env';
import {
  createFactoryShipmentOrderSchema,
  type CreateFactoryShipmentOrderData,
} from '@/lib/schemas/factory-shipment';
import {
  FACTORY_SHIPMENT_STATUS,
  FACTORY_SHIPMENT_STATUS_LABELS,
} from '@/lib/types/factory-shipment';
import { cn } from '@/lib/utils';

interface FactoryShipmentOrderFormProps {
  orderId?: string;
  onSuccess?: (order: unknown) => void;
  onCancel?: () => void;
}

// 模拟API调用 - 后续替换为真实API
const createFactoryShipmentOrder = async (
  data: CreateFactoryShipmentOrderData
) =>
  // TODO: 实现真实API调用
  ({ id: 'mock-id', ...data });
const updateFactoryShipmentOrder = async (
  id: string,
  data: CreateFactoryShipmentOrderData
) =>
  // TODO: 实现真实API调用
  ({ id, ...data });
const getFactoryShipmentOrder = async (_id: string) =>
  // TODO: 实现真实API调用
  null; // 模拟数据
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
          unit: 'piece',
          remarks: '',
        },
      ],
    },
  });

  // 商品明细字段数组
  const { fields, append, remove } = useFieldArray({
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

  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () =>
      getSuppliers({ page: 1, limit: factoryShipmentConfig.queryLimit }),
  });
  const _suppliers = suppliersResponse?.data || [];

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
    queryFn: () => getFactoryShipmentOrder(orderId ?? ''),
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
    mutationFn: (data: any) => updateFactoryShipmentOrder(orderId!, data),
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
      const order = orderDetail as any; // 临时类型断言，等待真实API实现
      form.reset({
        containerNumber: order.containerNumber,
        customerId: order.customerId,
        status: order.status,
        totalAmount: order.totalAmount,
        receivableAmount: order.receivableAmount,
        depositAmount: order.depositAmount,
        remarks: order.remarks || '',
        planDate: order.planDate ? new Date(order.planDate) : undefined,
        items: order.items.map((item: any) => ({
          productId: item.productId || '',
          supplierId: item.supplierId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          isManualProduct: item.isManualProduct,
          manualProductName: item.manualProductName || '',
          manualSpecification: item.manualSpecification || '',
          manualWeight: item.manualWeight,
          manualUnit: item.manualUnit || '',
          displayName: item.displayName,
          specification: item.specification || '',
          unit: item.unit,
          weight: item.weight,
          remarks: item.remarks || '',
        })),
      });
    }
  }, [orderDetail, isEditing, form]);

  // 添加商品明细
  const handleAddItem = () => {
    append({
      productId: '',
      supplierId: '',
      quantity: 1,
      unitPrice: 0,
      displayName: '',
      specification: '',
      unit: 'piece',
      remarks: '',
    });
  };

  // 删除商品明细
  const handleRemoveItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  // 计算订单总金额
  const calculateTotalAmount = () => {
    const items = form.getValues('items');
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  // 自动计算总金额
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name?.includes('quantity') || name?.includes('unitPrice')) {
        const totalAmount = calculateTotalAmount();
        form.setValue('totalAmount', totalAmount);
        if (!form.getValues('receivableAmount')) {
          form.setValue('receivableAmount', totalAmount);
        }
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="containerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>集装箱号码 *</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入集装箱号码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>客户 *</FormLabel>
                    <FormControl>
                      <CustomerSelector
                        customers={customers}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="请选择客户"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>订单状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="选择订单状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(FACTORY_SHIPMENT_STATUS_LABELS).map(
                          ([status, label]) => (
                            <SelectItem key={status} value={status}>
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
                name="planDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>计划发货日期</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'yyyy-MM-dd', {
                                locale: zhCN,
                              })
                            ) : (
                              <span>选择日期</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={date => date < new Date('1900-01-01')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="请输入备注信息"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 商品明细 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                商品明细
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加商品
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="mb-4 flex items-start justify-between">
                      <h4 className="text-sm font-medium">商品 {index + 1}</h4>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {/* 商品选择 */}
                      <div className="sm:col-span-2 lg:col-span-1">
                        <IntelligentProductInput
                          form={form}
                          index={index}
                          products={products}
                          onProductChange={product => {
                            if (product && selectedCustomerId) {
                              // 自动填充客户历史价格（厂家发货价格）
                              const customerPrice = getLatestPrice(
                                customerPriceHistoryData?.data,
                                product.id,
                                'FACTORY'
                              );
                              if (customerPrice !== undefined) {
                                form.setValue(
                                  `items.${index}.unitPrice`,
                                  customerPrice
                                );
                                toast({
                                  title: '已自动填充客户历史价格',
                                  description: `产品 "${product.name}" 的上次厂家发货价格：¥${customerPrice}`,
                                  duration: 2000,
                                });
                              }
                            }
                          }}
                        />
                      </div>

                      {/* 供应商选择（带价格自动填充） */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.supplierId`}
                        render={({ field }) => (
                          <SupplierPriceSelector
                            form={form}
                            index={index}
                            value={field.value}
                            onChange={field.onChange}
                          />
                        )}
                      />

                      {/* 数量 */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              数量 *
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0"
                                className="h-8 text-xs"
                                {...field}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      {/* 单价 */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.unitPrice`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              单价 *
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="h-8 text-xs"
                                {...field}
                                onChange={e =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />

                      {/* 小计 */}
                      <div className="flex items-end">
                        <div className="w-full">
                          <label className="text-xs font-medium text-gray-700">
                            小计
                          </label>
                          <div className="mt-1 flex h-8 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-xs">
                            ¥
                            {(
                              (form.watch(`items.${index}.quantity`) || 0) *
                              (form.watch(`items.${index}.unitPrice`) || 0)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* 备注 */}
                      <FormField
                        control={form.control}
                        name={`items.${index}.remarks`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              备注
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="备注信息"
                                className="h-8 text-xs"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 财务信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              财务信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>订单总金额</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={e =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receivableAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>应收金额</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={e =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="depositAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>定金金额</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={e =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
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

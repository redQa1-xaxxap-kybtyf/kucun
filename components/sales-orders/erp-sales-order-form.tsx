'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';

import { InventoryChecker } from '@/components/sales-orders/inventory-checker';
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
import { Label } from '@/components/ui/label';
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
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  CreateSalesOrderSchema,
  type CreateSalesOrderData,
} from '@/lib/schemas/sales-order';

interface ERPSalesOrderFormProps {
  onSuccess?: (order: unknown) => void;
  onCancel?: () => void;
}

/**
 * ERP风格的销售订单表单组件
 * 采用中国主流ERP系统的界面设计模式
 */
export function ERPSalesOrderForm({
  onSuccess,
  onCancel,
}: ERPSalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 表单状态
  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    defaultValues: {
      customerId: '',
      status: 'draft',
      remarks: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 数据查询
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: customerQueryKeys.list(),
    queryFn: () => getCustomers(),
  });

  const { data: productsData, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list(),
    queryFn: () => getProducts(),
  });

  // 创建订单
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '订单创建成功',
        description: `订单号：${data.orderNumber}`,
      });
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      onSuccess?.(data);
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 计算总金额
  const totalAmount = fields.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );

  // 添加商品
  const addOrderItem = () => {
    append({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      colorCode: '',
      productionDate: '',
    });
  };

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  // 页面加载时自动生成订单号
  React.useEffect(() => {
    const generateOrderNumber = async () => {
      try {
        const response = await fetch(
          '/api/sales-orders/generate-order-number?action=generate'
        );
        const data = await response.json();
        if (data.success) {
          setAutoOrderNumber(data.data.orderNumber);
        }
      } catch (error) {
        console.error('自动生成订单号失败:', error);
        // 如果API失败，使用本地生成逻辑作为备用
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        setAutoOrderNumber(`SO${dateStr}${timeStr}`);
      }
    };

    generateOrderNumber();
  }, []);

  // 提交表单
  const onSubmit = (data: CreateSalesOrderData) => {
    // 不传递orderNumber，让后端自动生成
    const { orderNumber, ...submitData } = data;
    createMutation.mutate(submitData);
  };

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCancel?.() || router.back()}
            className="h-8"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-lg font-semibold">新建销售订单</h1>
            <p className="text-sm text-muted-foreground">创建新的销售订单</p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* ERP标准布局：基本信息区域 */}
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <h3 className="text-sm font-medium">基本信息</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-4">
                {/* 订单号 - 自动生成显示 */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    订单号
                  </Label>
                  <div className="rounded border bg-muted/50 px-2 py-1 font-mono text-xs">
                    {autoOrderNumber || '正在生成...'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    系统将自动生成唯一订单号
                  </p>
                </div>

                {/* 客户名称 */}
                <div className="space-y-1">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          客户名称 <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={customersLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="请选择客户" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customersData?.data?.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                <div className="flex flex-col items-start">
                                  <span className="text-xs font-medium">
                                    {customer.name}
                                  </span>
                                  {customer.phone && (
                                    <span className="text-xs text-muted-foreground">
                                      {customer.phone}
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 订单状态 */}
                <div className="space-y-1">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          订单状态
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="请选择状态" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-yellow-500"></div>
                                <span className="text-xs">草稿</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="confirmed">
                              <div className="flex items-center gap-1">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                                <span className="text-xs">已确认</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 创建日期 */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    创建日期
                  </Label>
                  <div className="rounded border bg-muted/50 px-2 py-1 text-xs">
                    {new Date().toLocaleDateString('zh-CN')}
                  </div>
                </div>
              </div>

              {/* 备注信息 */}
              <div className="mt-3 space-y-1 md:col-span-2 lg:col-span-4">
                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        备注信息
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="订单备注（选填）"
                          className="min-h-[40px] resize-none text-xs"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>

          {/* ERP标准布局：订单明细表格 */}
          <div className="rounded border bg-card">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
              <h3 className="text-sm font-medium">订单明细</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOrderItem}
                className="h-6 px-2 text-xs"
              >
                <Plus className="mr-1 h-3 w-3" />
                添加商品
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p className="text-sm">暂无商品明细</p>
                <p className="text-xs">
                  点击&ldquo;添加商品&rdquo;按钮开始添加
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/20">
                      <TableHead className="h-8 text-xs">序号</TableHead>
                      <TableHead className="h-8 text-xs">商品名称</TableHead>
                      <TableHead className="h-8 text-xs">颜色</TableHead>
                      <TableHead className="h-8 text-xs">生产日期</TableHead>
                      <TableHead className="h-8 text-xs">数量</TableHead>
                      <TableHead className="h-8 text-xs">单价</TableHead>
                      <TableHead className="h-8 text-xs">金额</TableHead>
                      <TableHead className="h-8 text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const _selectedProduct = productsData?.data?.find(
                        p => p.id === field.productId
                      );
                      const itemAmount =
                        (field.quantity || 0) * (field.unitPrice || 0);

                      return (
                        <TableRow key={field.id} className="h-10">
                          <TableCell className="text-xs">{index + 1}</TableCell>
                          <TableCell className="min-w-[150px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.productId`}
                              render={({ field: productField }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={value => {
                                      productField.onChange(value);
                                      const product = productsData?.data?.find(
                                        p => p.id === value
                                      );
                                      if (product) {
                                        form.setValue(
                                          `items.${index}.unitPrice`,
                                          product.price
                                        );
                                      }
                                    }}
                                    defaultValue={productField.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="选择商品" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {productsData?.data?.map(product => (
                                        <SelectItem
                                          key={product.id}
                                          value={product.id}
                                        >
                                          <div className="flex flex-col items-start">
                                            <span className="text-xs font-medium">
                                              {product.name}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                              ¥{product.price}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="min-w-[80px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.colorCode`}
                              render={({ field: colorField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="颜色"
                                      className="h-7 text-xs"
                                      {...colorField}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="min-w-[100px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.productionDate`}
                              render={({ field: dateField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="date"
                                      className="h-7 text-xs"
                                      {...dateField}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="min-w-[80px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.quantity`}
                              render={({ field: quantityField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="1"
                                      placeholder="数量"
                                      className="h-7 text-xs"
                                      {...quantityField}
                                      onChange={e =>
                                        quantityField.onChange(
                                          Number(e.target.value)
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="min-w-[80px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.unitPrice`}
                              render={({ field: priceField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="单价"
                                      className="h-7 text-xs"
                                      {...priceField}
                                      onChange={e =>
                                        priceField.onChange(
                                          Number(e.target.value)
                                        )
                                      }
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            ¥{itemAmount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ERP标准布局：汇总信息 */}
          <div className="rounded border bg-card">
            <div className="border-b bg-muted/30 px-3 py-2">
              <h3 className="text-sm font-medium">汇总信息</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    商品种类
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {fields.length} 种
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-green-50/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">总数量</span>
                  <span className="text-sm font-semibold text-green-600">
                    {fields.reduce(
                      (sum, item) => sum + (item.quantity || 0),
                      0
                    )}{' '}
                    件
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-orange-50/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    订单总金额
                  </span>
                  <span className="text-lg font-bold text-orange-600">
                    ¥
                    {totalAmount.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 库存检查 */}
          {fields.length > 0 && (
            <InventoryChecker
              items={fields.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                colorCode: item.colorCode,
                productionDate: item.productionDate,
              }))}
              products={productsData?.data || []}
              onInventoryCheck={results => {
                // 处理库存检查结果
                console.log('库存检查结果:', results);
              }}
            />
          )}

          {/* ERP标准布局：操作按钮 */}
          <div className="sticky bottom-0 rounded border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onCancel?.() || router.back()}
                  disabled={createMutation.isPending}
                  className="h-8 text-xs"
                >
                  取消
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  variant="outline"
                  disabled={
                    createMutation.isPending || !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => {
                    form.setValue('status', 'draft');
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  保存草稿
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    fields.length === 0 ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => {
                    form.setValue('status', 'confirmed');
                    form.handleSubmit(onSubmit)();
                  }}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  提交订单
                </Button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="text-xs text-muted-foreground">
                保存草稿：可随时修改；提交订单：确认后进入处理流程
              </p>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

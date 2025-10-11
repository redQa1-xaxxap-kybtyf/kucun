'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import {
  InventoryChecker,
  InventoryStatus,
} from '@/components/sales-orders/inventory-checker';
import { ProductSelector } from '@/components/sales-orders/product-selector';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type { Customer } from '@/lib/types/customer';
import { SALES_ORDER_STATUS_LABELS } from '@/lib/types/sales-order';
import { transformFormDataToCreateInput } from '@/lib/utils/sales-order-transforms';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

interface EnhancedSalesOrderFormProps {
  onSuccess?: (order: unknown) => void;
  onCancel?: () => void;
}

/**
 * 增强的销售订单表单组件
 * 集成完整的开票字段和库存检查功能
 */
export function EnhancedSalesOrderForm({
  onSuccess,
  onCancel,
}: EnhancedSalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 表单配置
  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    defaultValues: {
      customerId: '',
      status: 'draft',
      remarks: '',
      items: [],
    },
  });

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  // 订单项字段数组
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

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

  // 获取客户列表
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  // 获取产品列表
  const { data: productsData, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 200 }),
    queryFn: () => getProducts({ page: 1, limit: 200 }),
  });

  // 创建销售订单Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `销售订单 &ldquo;${data.orderNumber}&rdquo; 创建成功！`,
      });
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push('/sales-orders');
      }
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  // 状态管理
  const [selectedCustomer, setSelectedCustomer] =
    React.useState<Customer | null>(null);
  const [productSearch, setProductSearch] = React.useState('');
  const [stockWarnings, setStockWarnings] = React.useState<
    Record<string, string>
  >({});

  // 获取客户信息
  React.useEffect(() => {
    const customerId = form.watch('customerId');
    if (customerId && customersData?.data) {
      const customer = customersData.data.find(c => c.id === customerId);
      setSelectedCustomer(customer || null);
    }
  }, [form.watch('customerId'), customersData]);

  // 添加订单项
  const addOrderItem = () => {
    append({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      displayUnit: '件' as const,
      displayQuantity: 1,
      unitCost: undefined,
      manualWeight: undefined,
    } as unknown as never);
  };

  // 删除订单项
  const removeOrderItem = (index: number) => {
    remove(index);
  };

  // 更新订单项并计算小计
  const updateOrderItem = (
    index: number,
    field: string,
    value: string | number
  ) => {
    const currentItem = fields[index];
    const updatedItem = { ...currentItem, [field]: value };

    // 自动计算小计
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItem.subtotal =
        (updatedItem.quantity ?? 0) * (updatedItem.unitPrice || 0);
    }

    update(index, updatedItem);

    // 检查库存
    if (field === 'productId' && value) {
      checkProductStock(String(value), index);
    }
  };

  // 检查产品库存
  const checkProductStock = (productId: string, itemIndex: number) => {
    const product = productsData?.data?.find(p => p.id === productId);
    if (product?.inventory) {
      const availableStock = product.inventory.availableQuantity || 0;
      const requestedQuantity = fields[itemIndex]?.quantity || 0;

      if (requestedQuantity > availableStock) {
        setStockWarnings(prev => ({
          ...prev,
          [itemIndex]: `库存不足！可用库存：${availableStock}${product.unit}`,
        }));
      } else {
        setStockWarnings(prev => {
          const newWarnings = { ...prev };
          delete newWarnings[itemIndex];
          return newWarnings;
        });
      }
    }
  };

  // 自动填充产品信息
  const handleProductSelect = (productId: string, itemIndex: number) => {
    const product = productsData?.data?.find(p => p.id === productId);
    if (product) {
      updateOrderItem(itemIndex, 'productId', productId);
      // 可以在这里设置默认单价等信息
      // updateOrderItem(itemIndex, "unitPrice", product.defaultPrice || 0)
    }
  };

  // 计算订单总金额
  const totalAmount = React.useMemo(
    () =>
      fields.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice || 0),
        0
      ),
    [fields]
  );

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!productsData?.data) {
      return [];
    }

    return productsData.data.filter(
      product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.code.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [productsData?.data, productSearch]);

  // 表单提交
  const onSubmit = (data: CreateSalesOrderData) => {
    // 不传递orderNumber，让后端自动生成
    const { orderNumber: _orderNumber, ...submitData } = data;

    // 使用类型安全的转换函数
    const apiData = transformFormDataToCreateInput(submitData);

    createMutation.mutate(apiData);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : router.back())}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新建销售订单</h1>
          <p className="text-muted-foreground">
            创建新的销售订单，支持完整的开票信息
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* ERP标准布局：顶部基本信息区域 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-4 py-2">
              <h3 className="text-sm font-medium">基本信息</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 lg:grid-cols-4">
                {/* 订单号 - 自动生成显示 */}
                <div className="space-y-1">
                  <FormLabel className="text-muted-foreground text-xs">
                    订单号
                  </FormLabel>
                  <div className="bg-muted/50 rounded border px-2 py-1 font-mono text-sm">
                    {autoOrderNumber || '正在生成...'}
                  </div>
                  <p className="text-muted-foreground text-xs">
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
                        <FormLabel className="text-muted-foreground text-xs">
                          客户名称 <span className="text-destructive">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={customersLoading}
                        >
                          <FormControl>
                            <SelectTrigger className="h-7 text-sm">
                              <SelectValue placeholder="请选择客户" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customersData?.data?.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                <div className="flex flex-col items-start">
                                  <span className="font-medium">
                                    {customer.name}
                                  </span>
                                  {customer.phone && (
                                    <span className="text-muted-foreground text-xs">
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

                {/* 客户详细信息显示 */}
                {selectedCustomer && (
                  <div className="space-y-3 rounded-lg border border-blue-200/50 bg-blue-50/50 p-4">
                    <div className="text-sm font-medium text-blue-700">
                      客户详细信息
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          📞 联系电话：
                        </span>
                        <span className="font-medium">
                          {selectedCustomer.phone || '未填写'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          📍 客户地址：
                        </span>
                        <span className="max-w-[200px] truncate text-right font-medium">
                          {selectedCustomer.address || '未填写'}
                        </span>
                      </div>
                      {selectedCustomer.transactionCount !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            📊 历史交易：
                          </span>
                          <span className="text-primary font-medium">
                            {selectedCustomer.transactionCount}次
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 订单信息 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">订单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 简化的订单号显示 */}
              <div className="space-y-2">
                <FormLabel className="text-sm font-medium">订单号</FormLabel>
                <div className="flex gap-2">
                  <div className="bg-muted/50 flex-1 rounded-md border px-3 py-2 text-sm">
                    {form.watch('orderNumber') || '点击生成订单号'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const response = await fetch(
                          '/api/sales-orders/generate-order-number?action=generate'
                        );
                        const data = await response.json();
                        if (data.success) {
                          form.setValue('orderNumber', data.data.orderNumber);
                        }
                      } catch (error) {
                        console.error('生成订单号失败:', error);
                      }
                    }}
                    disabled={createMutation.isPending}
                    className="shrink-0"
                  >
                    生成
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      订单状态
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="请选择订单状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(SALES_ORDER_STATUS_LABELS).map(
                          ([status, label]) => (
                            <SelectItem key={status} value={status}>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    status === 'draft'
                                      ? 'bg-yellow-500'
                                      : status === 'confirmed'
                                        ? 'bg-green-500'
                                        : status === 'shipped'
                                          ? 'bg-blue-500'
                                          : status === 'completed'
                                            ? 'bg-green-600'
                                            : status === 'cancelled'
                                              ? 'bg-red-500'
                                              : 'bg-gray-500'
                                  }`}
                                ></div>
                                {label}
                              </div>
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
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">
                      备注信息
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="订单备注（选填）"
                        className="min-h-[60px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 订单汇总 */}
          <Card className="lg:col-span-2 xl:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">订单汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 重要金额信息突出显示 */}
              <div className="border-primary/20 from-primary/10 to-primary/5 rounded-lg border bg-linear-to-r p-4">
                <div className="space-y-2 text-center">
                  <div className="text-muted-foreground text-sm">
                    订单总金额
                  </div>
                  <div className="text-primary text-3xl font-bold">
                    ¥
                    {totalAmount.toLocaleString('zh-CN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </div>
              </div>

              {/* 详细统计信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-muted-foreground mb-1">商品种类</div>
                  <div className="text-xl font-semibold text-blue-600">
                    {fields.length}
                  </div>
                  <div className="text-muted-foreground text-xs">种</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-muted-foreground mb-1">总数量</div>
                  <div className="text-xl font-semibold text-green-600">
                    {fields.reduce((sum, item) => sum + (item.quantity ?? 0), 0)}
                  </div>
                  <div className="text-muted-foreground text-xs">件</div>
                </div>
              </div>

              {/* 库存警告汇总 */}
              {Object.keys(stockWarnings).length > 0 && (
                <Alert variant="destructive" className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    ⚠️ 存在 {Object.keys(stockWarnings).length}{' '}
                    个商品库存不足，请检查库存
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* 库存检查 */}
          {fields.length > 0 && (
            <InventoryChecker
              items={fields.map(item => ({
                productId: item.productId || '',
                quantity: item.quantity ?? 0,
                batchNumber:
                  'batchNumber' in item && typeof item.batchNumber === 'string'
                    ? item.batchNumber
                    : '',
              }))}
              products={productsData?.data || []}
              onInventoryCheck={results => {
                // 更新库存警告状态
                const warnings: Record<string, string> = {};
                results.forEach((result, index) => {
                  if (
                    result.severity === 'error' ||
                    result.severity === 'warning'
                  ) {
                    warnings[index] = result.message;
                  }
                });
                setStockWarnings(warnings);
              }}
            />
          )}

          {/* 订单明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">订单明细</CardTitle>
                <Button type="button" onClick={addOrderItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加商品
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <p className="mb-2 font-medium">暂无商品明细</p>
                  <p className="text-sm">
                    点击&ldquo;添加商品&rdquo;按钮开始添加
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 产品搜索 */}
                  <div className="flex items-center gap-2">
                    <Search className="text-muted-foreground h-4 w-4" />
                    <Input
                      placeholder="搜索产品名称或编码..."
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>

                  {/* 订单明细表格 */}
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">产品信息</TableHead>
                          <TableHead className="w-[120px]">色号</TableHead>
                          <TableHead className="w-[120px]">生产日期</TableHead>
                          <TableHead className="w-[100px]">数量</TableHead>
                          <TableHead className="w-[120px]">单价</TableHead>
                          <TableHead className="w-[120px]">小计</TableHead>
                          <TableHead className="w-[80px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.map((item, index) => {
                          const selectedProduct = productsData?.data?.find(
                            p => p.id === item.productId
                          );
                          const subtotal =
                            (item.quantity ?? 0) * (item.unitPrice || 0);
                          const hasStockWarning = stockWarnings[index];

                          return (
                            <TableRow
                              key={item.id}
                              className={
                                hasStockWarning ? 'bg-destructive/5' : ''
                              }
                            >
                              <TableCell>
                                <div className="space-y-2">
                                  <ProductSelector
                                    products={filteredProducts}
                                    value={item.productId}
                                    onValueChange={value =>
                                      handleProductSelect(value, index)
                                    }
                                    placeholder="选择产品"
                                  />

                                  {selectedProduct && (
                                    <div className="flex items-center gap-2">
                                      <InventoryStatus
                                        product={selectedProduct}
                                        requestedQuantity={item.quantity ?? 0}
                                        className="text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <Input
                                  placeholder="批次号"
                                  value={
                                    'batchNumber' in item &&
                                    typeof item.batchNumber === 'string'
                                      ? item.batchNumber
                                      : ''
                                  }
                                  onChange={e =>
                                    updateOrderItem(
                                      index,
                                      'batchNumber',
                                      e.target.value
                                    )
                                  }
                                  className="w-full"
                                />
                              </TableCell>

                              <TableCell>
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={e =>
                                      updateOrderItem(
                                        index,
                                        'quantity',
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-full"
                                  />
                                  {hasStockWarning && (
                                    <div className="text-destructive text-xs">
                                      {stockWarnings[index]}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={e =>
                                    updateOrderItem(
                                      index,
                                      'unitPrice',
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-full"
                                />
                              </TableCell>

                              <TableCell>
                                <div className="font-medium">
                                  ¥{subtotal.toFixed(2)}
                                </div>
                              </TableCell>

                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOrderItem(index)}
                                  className="text-destructive hover:text-destructive"
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
                </div>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 - 优化为中国用户习惯 */}
          <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky bottom-0 border-t pt-6 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => (onCancel ? onCancel() : router.back())}
                disabled={createMutation.isPending}
                className="min-w-[100px]"
              >
                取消
              </Button>

              <div className="flex items-center gap-3">
                {/* 保存草稿按钮 */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // 设置状态为草稿并提交
                    form.setValue('status', 'draft');
                    form.handleSubmit(onSubmit)();
                  }}
                  disabled={
                    createMutation.isPending || !form.watch('customerId')
                  }
                  className="min-w-[120px]"
                >
                  {createMutation.isPending &&
                  form.watch('status') === 'draft' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      保存草稿
                    </>
                  )}
                </Button>

                {/* 提交订单按钮 */}
                <Button
                  type="button"
                  onClick={() => {
                    // 设置状态为已确认并提交
                    form.setValue('status', 'confirmed');
                    form.handleSubmit(onSubmit)();
                  }}
                  disabled={
                    createMutation.isPending ||
                    fields.length === 0 ||
                    !form.watch('customerId')
                  }
                  className="bg-primary hover:bg-primary/90 min-w-[120px]"
                >
                  {createMutation.isPending &&
                  form.watch('status') === 'confirmed' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      提交订单
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="text-muted-foreground mt-3 text-center text-xs">
              💡 保存草稿：可随时修改；提交订单：确认后进入处理流程
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

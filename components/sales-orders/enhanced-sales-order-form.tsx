'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  FileText,
  Loader2,
  Package,
  Plus,
  Save,
  Search,
  Trash2,
  User,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

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
  FormDescription,
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

// Custom Components
import {
  InventoryChecker,
  InventoryStatus,
} from '@/components/sales-orders/inventory-checker';
import { OrderNumberGenerator } from '@/components/sales-orders/order-number-generator';
import { ProductSelector } from '@/components/sales-orders/product-selector';

// API and Types
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type { CreateSalesOrderData } from '@/lib/schemas/sales-order';
import { CreateSalesOrderSchema } from '@/lib/schemas/sales-order';
import type { Customer } from '@/lib/types/customer';

interface EnhancedSalesOrderFormProps {
  onSuccess?: (order: any) => void;
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
      orderNumber: '',
      customerId: '',
      status: 'draft',
      remarks: '',
      items: [],
    },
  });

  // 订单项字段数组
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 获取客户列表
  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  // 获取产品列表
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 200 }),
    queryFn: () => getProducts({ page: 1, limit: 200 }),
  });

  // 创建销售订单Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `销售订单 "${data.orderNumber}" 创建成功！`,
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
      colorCode: '',
      productionDate: '',
      quantity: 1,
      unitPrice: 0,
    });
  };

  // 删除订单项
  const removeOrderItem = (index: number) => {
    remove(index);
  };

  // 更新订单项并计算小计
  const updateOrderItem = (index: number, field: string, value: any) => {
    const currentItem = fields[index];
    const updatedItem = { ...currentItem, [field]: value };

    // 自动计算小计
    if (field === 'quantity' || field === 'unitPrice') {
      updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
    }

    update(index, updatedItem);

    // 检查库存
    if (field === 'productId' && value) {
      checkProductStock(value, index);
    }
  };

  // 检查产品库存
  const checkProductStock = (productId: string, itemIndex: number) => {
    const product = productsData?.data?.find(p => p.id === productId);
    if (product?.inventory) {
      const availableStock = product.inventory.availableInventory || 0;
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
  const totalAmount = React.useMemo(() => {
    return fields.reduce((sum, item) => {
      return sum + item.quantity * item.unitPrice;
    }, 0);
  }, [fields]);

  // 过滤产品列表
  const filteredProducts = React.useMemo(() => {
    if (!productsData?.data) return [];

    return productsData.data.filter(
      product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.code.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [productsData?.data, productSearch]);

  // 表单提交
  const onSubmit = (data: CreateSalesOrderData) => {
    // 添加计算的总金额
    const orderData = {
      ...data,
      totalAmount,
      items: data.items.map(item => ({
        ...item,
        subtotal: item.quantity * item.unitPrice,
      })),
    };

    createMutation.mutate(orderData);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 客户信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  客户信息
                </CardTitle>
                <CardDescription>选择订单客户</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户 *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={customersLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择客户" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customersData?.data?.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              <div className="flex flex-col">
                                <span>{customer.name}</span>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 客户详细信息显示 */}
                {selectedCustomer && (
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <div className="text-sm">
                      <span className="font-medium">联系电话：</span>
                      {selectedCustomer.phone || '未填写'}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">客户地址：</span>
                      {selectedCustomer.address || '未填写'}
                    </div>
                    {selectedCustomer.transactionCount !== undefined && (
                      <div className="text-sm">
                        <span className="font-medium">历史交易：</span>
                        {selectedCustomer.transactionCount}次
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 订单信息 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  订单信息
                </CardTitle>
                <CardDescription>订单基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <OrderNumberGenerator
                  value={form.watch('orderNumber') || ''}
                  onChange={orderNumber =>
                    form.setValue('orderNumber', orderNumber)
                  }
                  disabled={createMutation.isPending}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>订单状态</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">草稿</SelectItem>
                          <SelectItem value="confirmed">已确认</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注信息</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入订单备注信息"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        订单的备注信息，将显示在开票单据上
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 订单汇总 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  订单汇总
                </CardTitle>
                <CardDescription>金额统计信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">商品种类：</span>
                    <span className="font-medium">{fields.length} 种</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">总数量：</span>
                    <span className="font-medium">
                      {fields.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>订单总额：</span>
                      <span className="text-primary">
                        ¥{totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 库存警告汇总 */}
                {Object.keys(stockWarnings).length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      存在 {Object.keys(stockWarnings).length} 个商品库存不足
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
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
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    订单明细
                  </CardTitle>
                  <CardDescription>
                    添加订单商品明细，支持完整的开票信息
                  </CardDescription>
                </div>
                <Button type="button" onClick={addOrderItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加商品
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {fields.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="mb-2 text-lg font-medium">暂无商品明细</p>
                  <p className="text-sm">点击"添加商品"按钮开始添加订单商品</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 产品搜索 */}
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
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
                          const subtotal = item.quantity * item.unitPrice;
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
                                        requestedQuantity={item.quantity}
                                        className="text-xs"
                                      />
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <Input
                                  placeholder="色号"
                                  value={item.colorCode || ''}
                                  onChange={e =>
                                    updateOrderItem(
                                      index,
                                      'colorCode',
                                      e.target.value
                                    )
                                  }
                                  className="w-full"
                                />
                              </TableCell>

                              <TableCell>
                                <Input
                                  type="date"
                                  value={item.productionDate || ''}
                                  onChange={e =>
                                    updateOrderItem(
                                      index,
                                      'productionDate',
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
                                    <div className="text-xs text-destructive">
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

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => (onCancel ? onCancel() : router.back())}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || fields.length === 0}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  创建中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  创建订单
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

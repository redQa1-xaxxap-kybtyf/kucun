'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { EnhancedProductSelector } from '@/components/sales-orders/enhanced-product-selector';
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
// API and Types
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

interface SalesOrderFormProps {
  onSuccess?: (order: CreateSalesOrderData) => void;
  onCancel?: () => void;
}

/**
 * 销售订单表单组件
 * 通用的销售订单创建界面
 */
export function SalesOrderForm({ onSuccess, onCancel }: SalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
  const { data: productsData } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getProducts({ page: 1, limit: 100 }),
  });

  // 创建销售订单Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '销售订单创建成功',
        description: `订单号 "${data.orderNumber}" 已创建`,
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
  const [stockWarnings, setStockWarnings] = React.useState<
    Record<string, string>
  >({});
  const [_isAdvancedOpen, _setIsAdvancedOpen] = React.useState(false);

  // 获取选中的客户信息
  const selectedCustomer = React.useMemo(() => {
    const customerId = form.watch('customerId');
    return customersData?.data?.find(c => c.id === customerId);
  }, [form.watch('customerId'), customersData?.data]);

  // 计算订单总金额
  const totalAmount = React.useMemo(
    () => fields.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [fields]
  );

  // 添加订单项
  const addOrderItem = () => {
    append({
      productId: '',
      quantity: 1,
      unitPrice: 0,
    });
  };

  // 删除订单项
  const removeOrderItem = (index: number) => {
    remove(index);
  };

  // 更新订单项
  const updateOrderItem = (
    index: number,
    field: string,
    value: string | number
  ) => {
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
      // 可以设置默认单价
      // updateOrderItem(itemIndex, "unitPrice", product.defaultPrice || 0)
    }
  };

  // 表单提交
  const onSubmit = (data: CreateSalesOrderData) => {
    // 不传递orderNumber，让后端自动生成，构建销售订单数据
    const { orderNumber: _orderNumber, ...submitData } = data;
    const orderData = {
      ...submitData,
      totalAmount,
      items: submitData.items.map(item => ({
        ...item,
        subtotal: item.quantity * item.unitPrice,
      })),
    };

    createMutation.mutate(orderData);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和进度 */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => (onCancel ? onCancel() : router.back())}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">创建销售订单</h1>
            <p className="text-muted-foreground">
              创建新的销售订单，管理客户订单和产品销售
            </p>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* 中国进销存标准单据布局 */}
          <div className="rounded-lg border bg-card">
            {/* 单据头部信息 */}
            <div className="border-b bg-muted/30 px-6 py-4">
              <div className="grid grid-cols-12 items-center gap-4">
                {/* 订单号 - 自动生成显示 */}
                <div className="col-span-3">
                  <label className="text-sm font-medium text-muted-foreground">
                    订单号
                  </label>
                  <div className="mt-1 font-mono text-lg font-semibold">
                    {autoOrderNumber || '正在生成...'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    系统自动生成
                  </p>
                </div>

                {/* 客户选择 */}
                <div className="col-span-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">
                          客户名称 *
                        </FormLabel>
                        <FormControl>
                          <CustomerSelector
                            customers={customersData?.data || []}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="选择客户"
                            disabled={customersLoading}
                            isLoading={customersLoading}
                            onCustomerCreated={_customer => {
                              // 刷新客户列表
                              queryClient.invalidateQueries({
                                queryKey: customerQueryKeys.lists(),
                              });
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 客户信息显示 */}
                <div className="col-span-3">
                  {selectedCustomer && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        联系电话
                      </label>
                      <div className="mt-1 text-sm">
                        {selectedCustomer.phone || '-'}
                      </div>
                    </div>
                  )}
                </div>

                {/* 订单状态 */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-muted-foreground">
                          状态
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-8">
                              <SelectValue />
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
                </div>
              </div>
            </div>

            {/* 产品明细表格 */}
            <div className="px-6 py-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">
                  产品明细
                </h3>
                <Button
                  type="button"
                  onClick={addOrderItem}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  添加
                </Button>
              </div>
              {/* 进销存标准表格 */}
              <div className="rounded border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="h-8 border-r text-xs font-medium">
                        序号
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        产品编码
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        产品名称
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        规格
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        数量
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        单价
                      </TableHead>
                      <TableHead className="h-8 border-r text-xs font-medium">
                        金额
                      </TableHead>
                      <TableHead className="h-8 text-xs font-medium">
                        操作
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-32 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Package className="h-8 w-8 opacity-50" />
                            <span className="text-sm">暂无产品明细</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      fields.map((item, index) => {
                        const selectedProduct = productsData?.data?.find(
                          p => p.id === item.productId
                        );
                        const subtotal = item.quantity * item.unitPrice;
                        const hasStockWarning = stockWarnings[index];

                        return (
                          <TableRow key={item.id} className="h-12">
                            {/* 序号 */}
                            <TableCell className="border-r text-center text-sm">
                              {index + 1}
                            </TableCell>

                            {/* 产品编码 */}
                            <TableCell className="border-r">
                              <div className="font-mono text-sm">
                                {selectedProduct?.code || '-'}
                              </div>
                            </TableCell>

                            {/* 产品名称 */}
                            <TableCell className="border-r">
                              <EnhancedProductSelector
                                products={productsData?.data || []}
                                value={item.productId}
                                onValueChange={value =>
                                  handleProductSelect(value, index)
                                }
                                placeholder="选择产品"
                              />
                            </TableCell>

                            {/* 规格 */}
                            <TableCell className="border-r">
                              <div className="text-sm">
                                {selectedProduct?.specification || '-'}
                              </div>
                            </TableCell>

                            {/* 数量 */}
                            <TableCell className="border-r">
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
                                className="h-8 text-center text-sm"
                              />
                              {hasStockWarning && (
                                <div className="mt-1 text-xs text-destructive">
                                  库存不足
                                </div>
                              )}
                            </TableCell>

                            {/* 单价 */}
                            <TableCell className="border-r">
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
                                className="h-8 text-right text-sm"
                              />
                            </TableCell>

                            {/* 金额 */}
                            <TableCell className="border-r">
                              <div className="text-right text-sm font-medium">
                                ¥{subtotal.toFixed(2)}
                              </div>
                            </TableCell>

                            {/* 操作 */}
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrderItem(index)}
                                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* 单据底部汇总 */}
            <div className="border-t bg-muted/30 px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  <span>
                    品种数：
                    <strong className="text-foreground">{fields.length}</strong>
                  </span>
                  <span>
                    总数量：
                    <strong className="text-foreground">
                      {fields.reduce((sum, item) => sum + item.quantity, 0)}
                    </strong>
                  </span>
                </div>
                <div className="text-lg font-bold">
                  合计金额：
                  <span className="text-primary">
                    ¥{totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* 单据备注和操作 */}
            <div className="space-y-4 px-6 py-4">
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-muted-foreground">
                      备注信息
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="请输入订单备注信息..."
                        className="min-h-[60px] resize-none text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={createMutation.isPending}
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={
                    !selectedCustomer ||
                    fields.length === 0 ||
                    createMutation.isPending
                  }
                  className="min-w-[120px]"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      创建订单
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

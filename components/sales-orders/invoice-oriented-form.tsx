/* eslint-disable max-lines, max-lines-per-function */

'use client';

import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { queryKeys } from '@/lib/queryKeys';
import type { SalesOrderCreateInput } from '@/lib/types/sales-order';
import { logger } from '@/lib/utils/console-logger';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

interface SalesOrderFormProps {
  initialOrderNumber?: string; // 新增：服务端预生成的订单号
  onSuccess?: (order: CreateSalesOrderData) => void;
  onCancel?: () => void;
}

/**
 * 销售订单表单组件
 * 通用的销售订单创建界面
 * 优化：支持接收预生成的订单号，消除加载延迟
 */
export function SalesOrderForm({
  initialOrderNumber,
  onSuccess,
  onCancel,
}: SalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  // 页面加载时设置订单号
  // 优化：优先使用服务端预生成的订单号，消除加载延迟
  React.useEffect(() => {
    // 如果有预生成的订单号，直接使用
    if (initialOrderNumber) {
      setAutoOrderNumber(initialOrderNumber);
      return;
    }

    // 降级方案：客户端异步生成（保持向后兼容）
    const generateOrderNumber = async () => {
      try {
        const response = await fetch(
          '/api/sales-orders/generate-order-number',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        const data = await response.json();
        if (data.success) {
          setAutoOrderNumber(data.data.orderNumber);
        }
      } catch (error) {
        logger.error('sales-orders:invoice-form', '自动生成订单号失败', error);
        // 如果API失败，使用本地生成逻辑作为备用
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const timeStr = now.getTime().toString().slice(-4);
        setAutoOrderNumber(`SO${dateStr}${timeStr}`);
      }
    };

    generateOrderNumber();
  }, [initialOrderNumber]);

  // 表单配置
  const form = useForm<CreateSalesOrderData>({
    resolver: standardSchemaResolver(CreateSalesOrderSchema),
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
    defaultValues: {
      customerId: '',
      status: 'draft',
      remarks: '',
      items: [],
      roundingAdjustment: undefined, // ✅ 新增: 抹零金额默认值
    },
  });

  // 订单项字段数组
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // 获取客户列表
  // 客户数据查询已移至 CustomerSelector 组件内部

  // 获取产品列表
  const { data: productsData } = useQuery({
    queryKey: productQueryKeys.list({
      page: 1,
      limit: 100,
      includeBatchSpecs: true,
    }),
    queryFn: () =>
      getProducts({ page: 1, limit: 100, includeBatchSpecs: true }),
  });

  // 创建销售订单Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '销售订单创建成功',
        description: `订单号 "${data.orderNumber}" 已创建`,
        variant: 'success',
      });

      // ✅ 失效销售订单缓存
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      // ✅ 关键修复：同时失效应收款缓存并强制重新获取
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
        refetchType: 'active',
      });

      if (onSuccess) {
        // data 是 SalesOrder 类型,需要转换为 CreateSalesOrderData
        onSuccess(data as unknown as CreateSalesOrderData);
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

  const _customerId = form.watch('customerId');

  // 客户数据查询已移至 CustomerSelector 组件内部

  // 计算订单总金额
  const totalAmount = React.useMemo(
    () =>
      fields.reduce(
        (sum, item) => sum + (item.quantity ?? 0) * (item.unitPrice || 0),
        0
      ),
    [fields]
  );

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
      roundingAdjustment: submitData.roundingAdjustment, // ✅ 新增: 包含抹零金额
      items: submitData.items.map(item => ({
        ...item,
        subtotal: (item.quantity ?? 0) * (item.unitPrice || 0),
      })),
    };

    // orderData 符合 SalesOrderCreateInput 类型
    createMutation.mutate(orderData as unknown as SalesOrderCreateInput);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和进度 */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            type="button"
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
          <div className="bg-card rounded-lg border">
            {/* 单据头部信息 */}
            <div className="bg-muted/30 border-b px-6 py-4">
              <div className="grid grid-cols-12 items-center gap-4">
                {/* 订单号 - 自动生成显示 */}
                <div className="col-span-3">
                  <label className="text-muted-foreground text-sm font-medium">
                    订单号
                  </label>
                  <div className="mt-1 font-mono text-lg font-semibold">
                    {autoOrderNumber || '正在生成...'}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
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
                        <FormLabel className="text-muted-foreground text-sm font-medium">
                          客户名称 *
                        </FormLabel>
                        <FormControl>
                          <CustomerSelector
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="选择客户"
                            onBlur={field.onBlur}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 客户信息显示（客户数据查询已移至 CustomerSelector 组件内部） */}
                <div className="col-span-3">{/* 客户信息不再显示 */}</div>

                {/* 订单状态 */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground text-sm font-medium">
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
                <h3 className="text-muted-foreground text-sm font-medium">
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
                        销售单价
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
                          colSpan={7}
                          className="text-muted-foreground h-32 text-center"
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
                        const subtotal =
                          (item.quantity ?? 0) * (item.unitPrice || 0);
                        const hasStockWarning = stockWarnings[index];

                        return (
                          <TableRow key={item.id} className="h-12">
                            {/* 产品编码 */}
                            <TableCell className="border-r">
                              <div className="font-mono text-sm">
                                {selectedProduct?.code || '-'}
                              </div>
                            </TableCell>

                            {/* 产品名称 */}
                            <TableCell className="border-r">
                              <EnhancedProductSelector
                                products={
                                  (productsData?.data || []).map(p => ({
                                    id: p.id,
                                    code: p.code,
                                    name: p.name,
                                    specification: p.specification,
                                    unit: p.unit,
                                    piecesPerUnit: p.piecesPerUnit,
                                    inventory: p.inventory
                                      ? {
                                          totalInventory:
                                            p.inventory.totalQuantity || 0,
                                          availableInventory:
                                            p.inventory.availableQuantity || 0,
                                          reservedInventory:
                                            p.inventory.reservedQuantity || 0,
                                        }
                                      : undefined,
                                  })) as unknown as Parameters<
                                    typeof EnhancedProductSelector
                                  >[0]['products']
                                }
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
                                type="text"
                                inputMode="decimal"
                                value={item.quantity ?? ''}
                                onChange={e => {
                                  const value = e.target.value;
                                  // 允许输入数字、小数点、空字符串
                                  if (
                                    value === '' ||
                                    /^\d*\.?\d*$/.test(value)
                                  ) {
                                    // 允许空值，不立即转换，让用户可以删除内容
                                    updateOrderItem(
                                      index,
                                      'quantity',
                                      value === '' ? '' : value
                                    );
                                  }
                                }}
                                onFocus={e => {
                                  // 聚焦时自动选中所有内容，方便用户直接输入新数量
                                  e.target.select();
                                }}
                                onBlur={e => {
                                  const value = e.target.value;
                                  // 失焦时处理空值：如果为空或只有小数点，设置为默认值1
                                  if (!value || value === '.') {
                                    updateOrderItem(index, 'quantity', 1);
                                  } else {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      updateOrderItem(
                                        index,
                                        'quantity',
                                        numValue
                                      );
                                    } else {
                                      // 如果解析失败，恢复为默认值1
                                      updateOrderItem(index, 'quantity', 1);
                                    }
                                  }
                                }}
                                className="h-8 text-center text-sm"
                              />
                              {hasStockWarning && (
                                <div className="text-destructive mt-1 text-xs">
                                  库存不足
                                </div>
                              )}
                            </TableCell>

                            {/* 单价 */}
                            <TableCell className="border-r">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={item.unitPrice ?? ''}
                                onChange={e => {
                                  const value = e.target.value;
                                  // 允许输入数字、小数点、负号
                                  if (
                                    value === '' ||
                                    /^-?\d*\.?\d*$/.test(value)
                                  ) {
                                    updateOrderItem(
                                      index,
                                      'unitPrice',
                                      value === '' ? 0 : value
                                    );
                                  }
                                }}
                                onFocus={e => {
                                  // 聚焦时自动选中所有内容，方便用户直接输入新价格
                                  e.target.select();
                                }}
                                onBlur={e => {
                                  const value = e.target.value;
                                  if (value && value !== '-' && value !== '.') {
                                    const numValue = parseFloat(value);
                                    if (!isNaN(numValue)) {
                                      updateOrderItem(
                                        index,
                                        'unitPrice',
                                        numValue
                                      );
                                    }
                                  }
                                }}
                                className="h-8 text-right text-sm"
                              />
                            </TableCell>

                            {/* 金额 */}
                            <TableCell className="border-r">
                              <div className="text-right text-sm font-medium">
                                ￥{subtotal.toFixed(2)}
                              </div>
                            </TableCell>

                            {/* 操作 */}
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrderItem(index)}
                                className="text-destructive hover:text-destructive h-6 w-6 p-0"
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
            <div className="bg-muted/30 border-t px-6 py-3">
              <div className="flex items-center justify-between">
                <div className="text-muted-foreground flex items-center gap-6 text-sm">
                  <span>
                    品种数：
                    <strong className="text-foreground">{fields.length}</strong>
                  </span>
                  <span>
                    总数量：
                    <strong className="text-foreground">
                      {fields.reduce(
                        (sum, item) => sum + (item.quantity ?? 0),
                        0
                      )}
                    </strong>
                  </span>
                </div>
                <div className="text-lg font-bold">
                  合计金额：
                  <span className="text-primary">
                    ￥{totalAmount.toFixed(2)}
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
                    <FormLabel className="text-muted-foreground text-sm font-medium">
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
                  disabled={fields.length === 0 || createMutation.isPending}
                  className="min-w-[120px]"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      新建订单
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

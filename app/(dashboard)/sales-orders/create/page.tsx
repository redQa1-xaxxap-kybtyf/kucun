'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

// UI Components
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

// API and Types
import { getCustomers, customerQueryKeys } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import type {
  CreateSalesOrderData } from '@/lib/schemas/sales-order';
import {
  CreateSalesOrderSchema
} from '@/lib/schemas/sales-order';

/**
 * 新建销售订单页面
 * 严格遵循全栈项目统一约定规范
 */
export default function CreateSalesOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 表单配置
  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    defaultValues: {
      customerId: '',
      orderNumber: '',
      status: 'draft',
      notes: '',
      items: [],
    },
  });

  // 获取客户列表
  const { data: customers } = useQuery({
    queryKey: customerQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getCustomers({ page: 1, limit: 100 }),
  });

  // 获取产品列表
  const { data: products } = useQuery({
    queryKey: productQueryKeys.list({ page: 1, limit: 100 }),
    queryFn: () => getProducts({ page: 1, limit: 100 }),
  });

  // 创建销售订单Mutation
  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast.success('销售订单创建成功');
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });
      router.push(`/sales-orders/${data.id}`);
    },
    onError: error => {
      toast.error(error instanceof Error ? error.message : '创建失败');
    },
  });

  // 订单项状态
  const [orderItems, setOrderItems] = React.useState<
    Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>
  >([]);

  // 添加订单项
  const addOrderItem = () => {
    setOrderItems([
      ...orderItems,
      {
        productId: '',
        quantity: 1,
        unitPrice: 0,
        subtotal: 0,
      },
    ]);
  };

  // 删除订单项
  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // 更新订单项
  const updateOrderItem = (index: number, field: string, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };

    // 计算小计
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[index].subtotal =
        newItems[index].quantity * newItems[index].unitPrice;
    }

    setOrderItems(newItems);
  };

  // 计算总金额
  const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

  // 表单提交处理
  const onSubmit = (data: CreateSalesOrderData) => {
    const orderData = {
      ...data,
      items: orderItems,
      totalAmount,
    };
    createMutation.mutate(orderData);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">新建销售订单</h1>
          <p className="text-muted-foreground">创建新的销售订单</p>
        </div>
      </div>

      {/* 销售订单表单 */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
                <CardDescription>填写订单的基本信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>订单号 *</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入订单号" {...field} />
                      </FormControl>
                      <FormDescription>订单的唯一标识号</FormDescription>
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择客户" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers?.data?.map(customer => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>状态 *</FormLabel>
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
                          <SelectItem value="shipped">已发货</SelectItem>
                          <SelectItem value="completed">已完成</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>备注</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请输入备注信息"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>订单的备注信息</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* 订单汇总 */}
            <Card>
              <CardHeader>
                <CardTitle>订单汇总</CardTitle>
                <CardDescription>订单金额和统计信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      商品数量:
                    </span>
                    <span className="font-medium">{orderItems.length} 项</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      总数量:
                    </span>
                    <span className="font-medium">
                      {orderItems.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-semibold">
                    <span>订单总额:</span>
                    <span>¥{totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 订单明细 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>订单明细</CardTitle>
                  <CardDescription>添加订单商品明细</CardDescription>
                </div>
                <Button type="button" onClick={addOrderItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加商品
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orderItems.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  暂无商品，请点击"添加商品"按钮添加
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品</TableHead>
                      <TableHead>数量</TableHead>
                      <TableHead>单价</TableHead>
                      <TableHead>小计</TableHead>
                      <TableHead className="w-[100px]">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orderItems.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Select
                            value={item.productId}
                            onValueChange={value =>
                              updateOrderItem(index, 'productId', value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="选择产品" />
                            </SelectTrigger>
                            <SelectContent>
                              {products?.data?.map(product => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e =>
                              updateOrderItem(
                                index,
                                'quantity',
                                Number(e.target.value)
                              )
                            }
                          />
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
                          />
                        </TableCell>
                        <TableCell>¥{item.subtotal.toFixed(2)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={createMutation.isPending}
            >
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
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

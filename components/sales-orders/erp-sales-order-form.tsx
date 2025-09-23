'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { getSuppliers, supplierQueryKeys } from '@/lib/api/suppliers';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

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

  // 单位映射表：将英文单位转换为中文
  const unitMapping: Record<string, string> = {
    piece: '件',
    pieces: '件',
    box: '箱',
    boxes: '箱',
    pack: '包',
    packs: '包',
    set: '套',
    sets: '套',
    unit: '个',
    units: '个',
    kg: '公斤',
    g: '克',
    m: '米',
    cm: '厘米',
    mm: '毫米',
    m2: '平方米',
    m3: '立方米',
    l: '升',
    ml: '毫升',
  };

  // 单位转换工具函数
  const convertQuantity = {
    // 片转件：数量 ÷ 每件片数
    piecesToUnits: (pieces: number, piecesPerUnit: number): number => {
      if (piecesPerUnit <= 0) return pieces;
      return Math.round((pieces / piecesPerUnit) * 100) / 100; // 保留2位小数
    },

    // 件转片：数量 × 每件片数
    unitsToPieces: (units: number, piecesPerUnit: number): number => {
      if (piecesPerUnit <= 0) return units;
      return Math.round(units * piecesPerUnit * 100) / 100; // 保留2位小数
    },

    // 根据显示单位转换为片数（系统存储单位）
    toSystemQuantity: (
      displayQuantity: number,
      displayUnit: '片' | '件',
      piecesPerUnit: number
    ): number => {
      if (displayUnit === '片') {
        return displayQuantity;
      } else {
        return convertQuantity.unitsToPieces(displayQuantity, piecesPerUnit);
      }
    },

    // 根据系统片数转换为显示数量
    toDisplayQuantity: (
      systemQuantity: number,
      displayUnit: '片' | '件',
      piecesPerUnit: number
    ): number => {
      if (displayUnit === '片') {
        return systemQuantity;
      } else {
        return convertQuantity.piecesToUnits(systemQuantity, piecesPerUnit);
      }
    },
  };

  // 单价转换工具函数
  const convertUnitPrice = {
    // 片单价转件单价：片单价 × 每件片数
    piecePriceToUnitPrice: (
      piecePrice: number,
      piecesPerUnit: number
    ): number => {
      if (piecesPerUnit <= 0 || piecePrice <= 0) return piecePrice;
      return Math.round(piecePrice * piecesPerUnit * 100) / 100; // 保留2位小数
    },

    // 件单价转片单价：件单价 ÷ 每件片数
    unitPriceToPiecePrice: (
      unitPrice: number,
      piecesPerUnit: number
    ): number => {
      if (piecesPerUnit <= 0 || unitPrice <= 0) return unitPrice;
      return Math.round((unitPrice / piecesPerUnit) * 100) / 100; // 保留2位小数
    },

    // 根据单位转换单价（保持总金额不变）
    convertPrice: (
      currentPrice: number,
      fromUnit: '片' | '件',
      toUnit: '片' | '件',
      piecesPerUnit: number
    ): number => {
      // 如果单位相同或价格为0，不需要转换
      if (fromUnit === toUnit || currentPrice <= 0 || piecesPerUnit <= 0) {
        return currentPrice;
      }

      if (fromUnit === '片' && toUnit === '件') {
        // 片 → 件：单价 × 每件片数
        return convertUnitPrice.piecePriceToUnitPrice(
          currentPrice,
          piecesPerUnit
        );
      } else if (fromUnit === '件' && toUnit === '片') {
        // 件 → 片：单价 ÷ 每件片数
        return convertUnitPrice.unitPriceToPiecePrice(
          currentPrice,
          piecesPerUnit
        );
      }

      return currentPrice;
    },
  };

  // 生成备注说明
  const generateRemarksText = (
    totalPieces: number,
    piecesPerUnit: number
  ): string => {
    if (piecesPerUnit <= 0 || totalPieces <= 0) return '';

    try {
      const result = calculatePieceDisplay(
        Math.floor(totalPieces),
        piecesPerUnit
      );
      // 只有当不是整件时才生成备注
      if (result.remainingPieces > 0) {
        return result.displayText;
      }
      return '';
    } catch (error) {
      console.error('生成备注失败:', error);
      return '';
    }
  };

  // 表单状态
  const form = useForm<CreateSalesOrderData>({
    resolver: zodResolver(CreateSalesOrderSchema),
    defaultValues: {
      customerId: '',
      status: 'draft',
      orderType: 'NORMAL',
      supplierId: '',
      costAmount: undefined,
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
    queryKey: customerQueryKeys.list({
      page: 1,
      limit: 100,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    }),
    queryFn: () =>
      getCustomers({
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const { data: productsData, isLoading: _productsLoading } = useQuery({
    queryKey: productQueryKeys.list(),
    queryFn: () => getProducts(),
  });

  const { data: suppliersData, isLoading: suppliersLoading } = useQuery({
    queryKey: supplierQueryKeys.list({
      page: 1,
      limit: 100,
      status: 'active',
      sortBy: 'name',
      sortOrder: 'asc',
    }),
    queryFn: () =>
      getSuppliers({
        page: 1,
        limit: 100,
        status: 'active',
        sortBy: 'name',
        sortOrder: 'asc',
      }),
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

  // 计算总金额：始终基于系统数量（片数）和片单价
  const watchedItems = form.watch('items') || [];
  const totalAmount = watchedItems.reduce((sum, item) => {
    // 计算片单价（如果当前显示单位是件，需要转换为片单价）
    const piecePriceForCalculation =
      item.displayUnit === '件' && item.unitPrice && item.piecesPerUnit
        ? convertUnitPrice.unitPriceToPiecePrice(
            item.unitPrice,
            item.piecesPerUnit
          )
        : item.unitPrice || 0;

    // 金额 = 系统数量（片数） × 片单价
    return sum + (item.quantity || 0) * piecePriceForCalculation;
  }, 0);

  // 重量格式化工具函数
  const formatWeight = (totalKg: number): string => {
    if (totalKg < 1000) {
      // 小于1吨：显示为kg，整数显示，四舍五入
      return `${Math.round(totalKg)}kg`;
    } else {
      // 大于等于1吨：显示为吨，保留1位小数，四舍五入
      const tons = totalKg / 1000;
      return `${Math.round(tons * 10) / 10}吨`;
    }
  };

  // 计算总重量：基于系统数量（片数）和产品重量
  const totalWeight = watchedItems.reduce((sum, item) => {
    // 查找对应的产品数据
    const product = productsData?.data?.find(p => p.id === item.productId);
    if (!product || !product.weight) return sum;

    // 重量 = 系统数量（片数） × 产品重量
    return sum + (item.quantity || 0) * product.weight;
  }, 0);

  // 添加商品
  const addOrderItem = () => {
    append({
      productId: '',
      specification: '',
      unit: '',
      displayUnit: '片' as const,
      displayQuantity: 1,
      quantity: 1,
      unitPrice: undefined, // 改为undefined，避免默认显示0
      piecesPerUnit: undefined,
      remarks: '',
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

  // 处理客户创建成功
  const handleCustomerCreated = (customer: {
    id: string;
    name: string;
    phone?: string;
  }) => {
    // 客户选择器会自动选择新创建的客户
    // 这里可以添加额外的处理逻辑，比如显示成功提示
    toast({
      title: '客户创建成功',
      description: `客户 "${customer.name}" 已创建并自动选择`,
      variant: 'success',
    });
  };

  // 提交表单
  const onSubmit = (data: CreateSalesOrderData) => {
    // 不传递orderNumber，让后端自动生成
    const { orderNumber: _orderNumber, ...submitData } = data;

    // 处理调货销售的字段：空字符串转为undefined
    const processedData = {
      ...submitData,
      supplierId:
        submitData.supplierId && submitData.supplierId.trim() !== ''
          ? submitData.supplierId
          : undefined,
    };

    createMutation.mutate(processedData);
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
                        <FormControl>
                          <CustomerSelector
                            customers={customersData?.data || []}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="搜索并选择客户"
                            disabled={customersLoading}
                            isLoading={customersLoading}
                            onCustomerCreated={handleCustomerCreated}
                            className="h-8"
                          />
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 订单类型 */}
                <div className="space-y-1">
                  <FormField
                    control={form.control}
                    name="orderType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs text-muted-foreground">
                          订单类型 <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="flex flex-row space-x-6"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="NORMAL" id="normal" />
                              <Label htmlFor="normal" className="text-xs">
                                正常销售
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="TRANSFER" id="transfer" />
                              <Label htmlFor="transfer" className="text-xs">
                                调货销售
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 调货销售特殊字段 */}
                {form.watch('orderType') === 'TRANSFER' && (
                  <>
                    {/* 供应商选择 */}
                    <div className="space-y-1">
                      <FormField
                        control={form.control}
                        name="supplierId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              供应商/调出方{' '}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || ''}
                              disabled={suppliersLoading}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="请选择供应商" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {suppliersData?.data?.map(supplier => (
                                  <SelectItem
                                    key={supplier.id}
                                    value={supplier.id}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs">
                                        {supplier.name}
                                      </span>
                                      {supplier.phone && (
                                        <span className="text-xs text-muted-foreground">
                                          ({supplier.phone})
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

                    {/* 成本金额 */}
                    <div className="space-y-1">
                      <FormField
                        control={form.control}
                        name="costAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs text-muted-foreground">
                              成本金额{' '}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="h-8 text-xs"
                                {...field}
                                value={field.value || ''}
                                onChange={e => {
                                  const value = e.target.value;
                                  field.onChange(
                                    value === '' ? undefined : parseFloat(value)
                                  );
                                }}
                              />
                            </FormControl>
                            <FormMessage className="text-xs" />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* 毛利显示 */}
                    {form.watch('costAmount') && form.watch('totalAmount') && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          预计毛利
                        </Label>
                        <div className="h-8 rounded-md border bg-muted/50 px-3 py-2 text-xs">
                          ¥
                          {(
                            (form.watch('totalAmount') || 0) -
                            (form.watch('costAmount') || 0)
                          ).toFixed(2)}
                        </div>
                      </div>
                    )}
                  </>
                )}

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
                      <TableHead className="h-8 text-xs">规格</TableHead>
                      <TableHead className="h-8 text-xs">单位</TableHead>
                      <TableHead className="h-8 text-xs">数量</TableHead>
                      <TableHead className="h-8 text-xs">单价</TableHead>
                      {form.watch('orderType') === 'TRANSFER' && (
                        <>
                          <TableHead className="h-8 text-xs">成本价</TableHead>
                          <TableHead className="h-8 text-xs">毛利</TableHead>
                        </>
                      )}
                      <TableHead className="h-8 text-xs">每件片数</TableHead>
                      <TableHead className="h-8 text-xs">金额</TableHead>
                      <TableHead className="h-8 text-xs">备注</TableHead>
                      <TableHead className="h-8 text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const _selectedProduct = productsData?.data?.find(
                        p => p.id === field.productId
                      );
                      // 金额计算：始终基于系统数量（片数）和片单价
                      const watchedQuantity = form.watch(
                        `items.${index}.quantity`
                      );
                      const watchedUnitPrice = form.watch(
                        `items.${index}.unitPrice`
                      );
                      const watchedDisplayUnit = form.watch(
                        `items.${index}.displayUnit`
                      );
                      const watchedPiecesPerUnit = form.watch(
                        `items.${index}.piecesPerUnit`
                      );

                      // 计算片单价（如果当前显示单位是件，需要转换为片单价）
                      const piecePriceForCalculation =
                        watchedDisplayUnit === '件' &&
                        watchedUnitPrice &&
                        watchedPiecesPerUnit
                          ? convertUnitPrice.unitPriceToPiecePrice(
                              watchedUnitPrice,
                              watchedPiecesPerUnit
                            )
                          : watchedUnitPrice || 0;

                      // 金额 = 系统数量（片数） × 片单价
                      const itemAmount =
                        (watchedQuantity || 0) * piecePriceForCalculation;

                      return (
                        <TableRow key={field.id} className="h-10">
                          <TableCell className="text-xs">{index + 1}</TableCell>
                          <TableCell className="min-w-[200px]">
                            <IntelligentProductInput
                              form={form}
                              index={index}
                              products={productsData?.data || []}
                              onProductChange={product => {
                                if (product) {
                                  // 自动填充产品相关信息（不包括价格）
                                  form.setValue(
                                    `items.${index}.specification`,
                                    product.specification || ''
                                  );
                                  form.setValue(
                                    `items.${index}.unit`,
                                    unitMapping[product.unit?.toLowerCase()] ||
                                      product.unit ||
                                      ''
                                  );
                                  form.setValue(
                                    `items.${index}.piecesPerUnit`,
                                    product.piecesPerUnit || undefined
                                  );
                                  // 初始化新的单位和数量字段
                                  form.setValue(
                                    `items.${index}.displayUnit`,
                                    '片'
                                  );
                                  form.setValue(
                                    `items.${index}.displayQuantity`,
                                    1
                                  );
                                  form.setValue(`items.${index}.quantity`, 1);
                                  // 清空备注，让用户手动输入或自动生成
                                  form.setValue(`items.${index}.remarks`, '');
                                }
                              }}
                            />
                          </TableCell>
                          {/* 规格列 */}
                          <TableCell className="min-w-[100px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.specification`}
                              render={({ field: specField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="规格"
                                      className="h-7 text-xs"
                                      readOnly
                                      {...specField}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          {/* 单位列 */}
                          <TableCell className="min-w-[60px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.displayUnit`}
                              render={({ field: displayUnitField }) => (
                                <FormItem>
                                  <Select
                                    onValueChange={value => {
                                      const newDisplayUnit = value as
                                        | '片'
                                        | '件';
                                      const currentDisplayUnit =
                                        displayUnitField.value || '片';
                                      const _currentDisplayQuantity =
                                        form.getValues(
                                          `items.${index}.displayQuantity`
                                        ) || 1;
                                      const piecesPerUnit =
                                        form.getValues(
                                          `items.${index}.piecesPerUnit`
                                        ) || 1;

                                      // 更新显示单位
                                      displayUnitField.onChange(newDisplayUnit);

                                      // 计算新的显示数量（从当前系统数量转换）
                                      const currentSystemQuantity =
                                        form.getValues(
                                          `items.${index}.quantity`
                                        ) || 1;
                                      const newDisplayQuantity =
                                        convertQuantity.toDisplayQuantity(
                                          currentSystemQuantity,
                                          newDisplayUnit,
                                          piecesPerUnit
                                        );

                                      // 更新显示数量
                                      form.setValue(
                                        `items.${index}.displayQuantity`,
                                        newDisplayQuantity
                                      );

                                      // 单价智能转换（保持总金额不变）
                                      const currentUnitPrice = form.getValues(
                                        `items.${index}.unitPrice`
                                      );
                                      if (
                                        currentUnitPrice &&
                                        currentUnitPrice > 0
                                      ) {
                                        const newUnitPrice =
                                          convertUnitPrice.convertPrice(
                                            currentUnitPrice,
                                            currentDisplayUnit,
                                            newDisplayUnit,
                                            piecesPerUnit
                                          );
                                        form.setValue(
                                          `items.${index}.unitPrice`,
                                          newUnitPrice
                                        );
                                      }

                                      // 生成备注（如果需要）
                                      const currentRemarks =
                                        form.getValues(
                                          `items.${index}.remarks`
                                        ) || '';
                                      if (!currentRemarks.trim()) {
                                        const remarksText = generateRemarksText(
                                          currentSystemQuantity,
                                          piecesPerUnit
                                        );
                                        if (remarksText) {
                                          form.setValue(
                                            `items.${index}.remarks`,
                                            remarksText
                                          );
                                        }
                                      }
                                    }}
                                    value={displayUnitField.value}
                                  >
                                    <FormControl>
                                      <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="单位" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="片">片</SelectItem>
                                      <SelectItem value="件">件</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          {/* 数量列 */}
                          <TableCell className="min-w-[80px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.displayQuantity`}
                              render={({ field: displayQuantityField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      placeholder="数量"
                                      className="h-7 text-xs"
                                      value={displayQuantityField.value || ''}
                                      onChange={e => {
                                        const newDisplayQuantity = Number(
                                          e.target.value
                                        );
                                        const displayUnit =
                                          form.getValues(
                                            `items.${index}.displayUnit`
                                          ) || '片';
                                        const piecesPerUnit =
                                          form.getValues(
                                            `items.${index}.piecesPerUnit`
                                          ) || 1;

                                        // 更新显示数量
                                        displayQuantityField.onChange(
                                          newDisplayQuantity
                                        );

                                        // 计算并更新系统数量（片数）
                                        const systemQuantity =
                                          convertQuantity.toSystemQuantity(
                                            newDisplayQuantity,
                                            displayUnit,
                                            piecesPerUnit
                                          );
                                        form.setValue(
                                          `items.${index}.quantity`,
                                          systemQuantity
                                        );

                                        // 自动生成备注（如果用户没有手动输入）
                                        const currentRemarks =
                                          form.getValues(
                                            `items.${index}.remarks`
                                          ) || '';
                                        if (!currentRemarks.trim()) {
                                          const remarksText =
                                            generateRemarksText(
                                              systemQuantity,
                                              piecesPerUnit
                                            );
                                          if (remarksText) {
                                            form.setValue(
                                              `items.${index}.remarks`,
                                              remarksText
                                            );
                                          }
                                        }
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          {/* 单价列 */}
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
                                      value={priceField.value || ''}
                                      onChange={e => {
                                        const value = e.target.value;
                                        // 如果输入为空，设置为undefined；否则转换为数字
                                        priceField.onChange(
                                          value === ''
                                            ? undefined
                                            : Number(value)
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>

                          {/* 调货销售专用字段 */}
                          {form.watch('orderType') === 'TRANSFER' && (
                            <>
                              {/* 成本价列 */}
                              <TableCell className="min-w-[80px]">
                                <FormField
                                  control={form.control}
                                  name={`items.${index}.unitCost`}
                                  render={({ field: costField }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          placeholder="成本价"
                                          className="h-7 text-xs"
                                          value={costField.value || ''}
                                          onChange={e => {
                                            const value = e.target.value;
                                            costField.onChange(
                                              value === ''
                                                ? undefined
                                                : Number(value)
                                            );
                                          }}
                                        />
                                      </FormControl>
                                      <FormMessage className="text-xs" />
                                    </FormItem>
                                  )}
                                />
                              </TableCell>

                              {/* 毛利列 */}
                              <TableCell className="min-w-[80px]">
                                <div className="flex h-7 items-center text-xs">
                                  {(() => {
                                    const unitCost =
                                      form.watch(`items.${index}.unitCost`) ||
                                      0;
                                    const unitPrice = watchedUnitPrice || 0;
                                    const quantity = watchedQuantity || 0;

                                    if (
                                      unitCost > 0 &&
                                      unitPrice > 0 &&
                                      quantity > 0
                                    ) {
                                      const profit =
                                        (unitPrice - unitCost) * quantity;
                                      return (
                                        <span
                                          className={
                                            profit >= 0
                                              ? 'text-green-600'
                                              : 'text-red-600'
                                          }
                                        >
                                          ¥{profit.toFixed(2)}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span className="text-muted-foreground">
                                        -
                                      </span>
                                    );
                                  })()}
                                </div>
                              </TableCell>
                            </>
                          )}

                          {/* 每件片数列 */}
                          <TableCell className="min-w-[80px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.piecesPerUnit`}
                              render={({ field: piecesField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="每件片数"
                                      className="h-7 text-xs"
                                      readOnly
                                      value={piecesField.value || ''}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          {/* 金额列 */}
                          <TableCell className="text-xs font-medium">
                            ¥{itemAmount.toFixed(2)}
                          </TableCell>
                          {/* 备注列 */}
                          <TableCell className="min-w-[120px]">
                            <FormField
                              control={form.control}
                              name={`items.${index}.remarks`}
                              render={({ field: remarksField }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      placeholder="备注信息"
                                      className="h-7 text-xs"
                                      {...remarksField}
                                    />
                                  </FormControl>
                                  <FormMessage className="text-xs" />
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="flex items-center justify-between rounded border bg-purple-50/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">总重量</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatWeight(totalWeight)}
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

                {/* 调货销售财务汇总 */}
                {form.watch('orderType') === 'TRANSFER' && (
                  <>
                    <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        总成本
                      </span>
                      <span className="text-sm font-semibold text-blue-600">
                        ¥
                        {(() => {
                          const items = form.watch('items') || [];
                          const totalCost = items.reduce((sum, item) => {
                            const unitCost = item.unitCost || 0;
                            const quantity = item.quantity || 0;
                            return sum + unitCost * quantity;
                          }, 0);
                          return totalCost.toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border bg-green-50/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        总毛利
                      </span>
                      <span className="text-sm font-semibold text-green-600">
                        ¥
                        {(() => {
                          const items = form.watch('items') || [];
                          const totalProfit = items.reduce((sum, item) => {
                            const unitCost = item.unitCost || 0;
                            const unitPrice = item.unitPrice || 0;
                            const quantity = item.quantity || 0;
                            return sum + (unitPrice - unitCost) * quantity;
                          }, 0);
                          return totalProfit.toLocaleString('zh-CN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          });
                        })()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded border bg-indigo-50/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        毛利率
                      </span>
                      <span className="text-sm font-semibold text-indigo-600">
                        {(() => {
                          const items = form.watch('items') || [];
                          const totalProfit = items.reduce((sum, item) => {
                            const unitCost = item.unitCost || 0;
                            const unitPrice = item.unitPrice || 0;
                            const quantity = item.quantity || 0;
                            return sum + (unitPrice - unitCost) * quantity;
                          }, 0);

                          if (totalAmount > 0) {
                            const profitRate =
                              (totalProfit / totalAmount) * 100;
                            return `${profitRate.toFixed(1)}%`;
                          }
                          return '0.0%';
                        })()}
                      </span>
                    </div>
                  </>
                )}
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

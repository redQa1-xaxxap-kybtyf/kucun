'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { BatchSelector } from '@/components/sales-orders/batch-selector';
import { CustomerSelector } from '@/components/sales-orders/customer-selector';
import { IntelligentProductInput } from '@/components/sales-orders/intelligent-product-input';
import { InventoryChecker } from '@/components/sales-orders/inventory-checker';
import { OrderItemRow } from '@/components/sales-orders/order-item-row';
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
import {
  getLatestPrice,
  useCustomerPriceHistory,
  type PriceType,
} from '@/hooks/use-price-history';
import { customerQueryKeys, getCustomers } from '@/lib/api/customers';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import {
  createSalesOrder,
  updateSalesOrder,
  salesOrderQueryKeys,
} from '@/lib/api/sales-orders';
import { getSuppliers, supplierQueryKeys } from '@/lib/api/suppliers';
import {
  SALES_ORDER_STATUS_LABELS,
  type SalesOrderStatus,
} from '@/lib/types/sales-order';
import { calculatePieceDisplay } from '@/lib/utils/piece-calculation';
import {
  transformFormDataToCreateInput,
  transformFormDataToUpdateInput,
} from '@/lib/utils/sales-order-transforms';
import {
  salesOrderCreateSchema as CreateSalesOrderSchema,
  type SalesOrderCreateFormData as CreateSalesOrderData,
} from '@/lib/validations/sales-order';

const UNIT_MAPPING: Record<string, string> = {
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

interface ERPSalesOrderFormProps {
  mode?: 'create' | 'edit';
  orderId?: string;
  initialData?: any; // 编辑模式的初始数据
  onSuccess?: (order: { id: string; orderNumber?: string }) => void;
  onCancel?: () => void;
}

/**
 * ERP风格的销售订单表单组件
 * 采用中国主流ERP系统的界面设计模式
 */
export function ERPSalesOrderForm({
  mode = 'create',
  orderId,
  initialData,
  onSuccess,
  onCancel,
}: ERPSalesOrderFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 单位转换工具函数
  const convertQuantity = {
    // 片转件：数量 ÷ 每件片数
    piecesToUnits: (pieces: number, piecesPerUnit: number): number => {
      if (piecesPerUnit <= 0) {
        return pieces;
      }
      return Math.round((pieces / piecesPerUnit) * 100) / 100; // 保留2位小数
    },

    // 件转片：数量 × 每件片数
    unitsToPieces: (units: number, piecesPerUnit: number): number => {
      if (piecesPerUnit <= 0) {
        return units;
      }
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
      if (piecesPerUnit <= 0 || piecePrice <= 0) {
        return piecePrice;
      }
      return Math.round(piecePrice * piecesPerUnit * 100) / 100; // 保留2位小数
    },

    // 件单价转片单价：件单价 ÷ 每件片数
    unitPriceToPiecePrice: (
      unitPrice: number,
      piecesPerUnit: number
    ): number => {
      if (piecesPerUnit <= 0 || unitPrice <= 0) {
        return unitPrice;
      }
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
    if (piecesPerUnit <= 0 || totalPieces <= 0) {
      return '';
    }

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

  // 监听客户ID变化
  const selectedCustomerId = form.watch('customerId');
  const orderType = form.watch('orderType');

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
    queryKey: productQueryKeys.list({}),
    queryFn: () => getProducts({}),
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

  // 获取客户的历史价格（根据订单类型决定价格类型）
  // 普通销售用SALES价格，调货销售用FACTORY价格
  const priceType: PriceType = orderType === 'NORMAL' ? 'SALES' : 'FACTORY';

  const { data: priceHistoryData } = useCustomerPriceHistory({
    customerId: selectedCustomerId,
    priceType,
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

  // 更新订单
  const updateMutation = useMutation({
    mutationFn: updateSalesOrder,
    onSuccess: response => {
      const order = response.data;
      toast({
        title: '订单更新成功',
        description: `订单号：${order?.orderNumber || ''}`,
      });
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.all });
      if (orderId) {
        queryClient.invalidateQueries({
          queryKey: salesOrderQueryKeys.detail(orderId),
        });
      }
      if (order) {
        onSuccess?.(order);
      }
    },
    onError: error => {
      toast({
        title: '更新失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 计算总金额：始终基于系统数量（片数）和片单价
  const watchedItems = form.watch('items') || [];

  const inventoryCheckItems = React.useMemo(
    () =>
      watchedItems.map(item => {
        const rawQuantity =
          item && typeof item === 'object' && 'quantity' in item
            ? (item as Record<string, unknown>).quantity
            : undefined;

        const numericQuantity =
          typeof rawQuantity === 'number'
            ? rawQuantity
            : Number(rawQuantity ?? 0);

        const batchNumber =
          item &&
          typeof item === 'object' &&
          'batchNumber' in item &&
          typeof (item as Record<string, unknown>).batchNumber === 'string'
            ? String((item as Record<string, unknown>).batchNumber)
            : '';

        const productId =
          item && typeof item === 'object' && 'productId' in item
            ? String((item as Record<string, unknown>).productId ?? '').trim()
            : '';

        return {
          productId,
          quantity: Number.isFinite(numericQuantity) ? numericQuantity : 0,
          batchNumber,
        };
      }),
    [watchedItems]
  );

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
    if (!product || !product.weight) {
      return sum;
    }

    // 重量 = 系统数量（片数） × 产品重量
    return sum + (item.quantity || 0) * product.weight;
  }, 0);

  // 添加商品
  const addOrderItem = () => {
    append({
      productId: '',
      productCode: '',
      specification: '',
      unit: '',
      displayUnit: '片',
      displayQuantity: 1,
      quantity: 1,
      unitPrice: 0,
      unitCost: undefined,
      piecesPerUnit: undefined,
      remarks: '',
    } as any);
  };

  // 自动生成订单号状态
  const [autoOrderNumber, setAutoOrderNumber] = React.useState<string>('');

  const creationDisplayDate = React.useMemo(() => {
    if (mode === 'edit' && initialData?.createdAt) {
      const parsedDate = new Date(initialData.createdAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }
    return new Date();
  }, [mode, initialData?.createdAt]);

  const initializedOrderRef = React.useRef<string | null>(null);

  // 编辑模式：填充初始数据
  React.useEffect(() => {
    if (mode !== 'edit') {
      initializedOrderRef.current = null;
      return;
    }

    if (!initialData) {
      return;
    }

    const orderKey = [
      initialData.id,
      initialData.orderNumber,
      initialData.updatedAt,
    ]
      .filter(Boolean)
      .join('__') || 'unknown-order';

    if (initializedOrderRef.current === orderKey) {
      return;
    }

    initializedOrderRef.current = orderKey;

    form.reset({
      orderNumber: initialData.orderNumber,
      customerId: initialData.customerId,
      status: initialData.status,
      orderType: initialData.orderType,
      supplierId: initialData.supplierId || '',
        costAmount: initialData.costAmount ?? undefined,
        remarks: initialData.remarks || '',
        items:
          initialData.items?.map((item: any) => ({
            productId: item.productId || '',
            productCode: item.productCode || item.product?.code || '',
            batchNumber: item.batchNumber || '',
            colorCode: item.colorCode || '',
            productionDate: item.productionDate || '',
            specification:
              item.specification || item.product?.specification || '',
            unit:
              UNIT_MAPPING[item.product?.unit?.toLowerCase() || ''] ||
              item.product?.unit ||
              '',
            displayUnit: (item.displayUnit || '片') as '片' | '件',
            displayQuantity:
              item.displayQuantity ?? item.quantity,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            piecesPerUnit:
              item.piecesPerUnit ?? item.product?.piecesPerUnit ?? undefined,
            remarks: item.remarks || '',
            subtotal: item.subtotal,
            unitCost: item.unitCost ?? undefined,
            isManualProduct: item.isManualProduct || false,
            manualProductName: item.manualProductName || '',
            manualSpecification: item.manualSpecification || '',
          manualWeight: item.manualWeight ?? undefined,
          manualUnit: item.manualUnit || '',
        })) || [],
    });
  }, [form, mode, initialData]);

  // 页面加载时自动生成订单号（仅创建模式）
  React.useEffect(() => {
    if (mode === 'create') {
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
    }
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
    if (mode === 'edit' && orderId) {
      // 编辑模式：更新现有订单
      const apiData = transformFormDataToUpdateInput(orderId, data);
      updateMutation.mutate(apiData);
    } else {
      // 创建模式：不传递orderNumber，让后端自动生成
      const { orderNumber: _orderNumber, ...submitData } = data;
      const apiData = transformFormDataToCreateInput(submitData);
      createMutation.mutate(apiData);
    }
  };

  const submitWithStatus = React.useCallback(
    (status: SalesOrderStatus) => {
      // 使用 as unknown as 双重类型转换，因为 CreateSalesOrderData 的 status 类型可能比 SalesOrderStatus 窄
      form.setValue('status', status as unknown as 'draft' | 'confirmed' | 'shipped' | 'completed' | 'cancelled', {
        shouldDirty: true,
        shouldValidate: false,
      });
      form.handleSubmit(onSubmit)();
    },
    [form, onSubmit]
  );

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* ERP标准布局：基本信息区域 */}
          <div className="bg-card rounded-lg border shadow-sm">
            <div className="border-b bg-gradient-to-r from-blue-50 to-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-700">基本信息</h3>
            </div>
            <div className="p-6">
              {/* 第一行：订单号和创建日期 */}
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 订单号 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    订单号
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-50 flex-1 rounded-md border border-blue-200 px-3 py-2 font-mono text-sm font-medium text-blue-700">
                      {mode === 'edit'
                        ? form.watch('orderNumber') || initialData?.orderNumber
                        : autoOrderNumber || '正在生成...'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    {mode === 'edit' ? '编辑现有订单' : '系统将自动生成唯一订单号'}
                  </p>
                </div>

                {/* 创建日期 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">
                    创建日期
                  </Label>
                  <div className="bg-gray-50 rounded-md border px-3 py-2 text-sm text-gray-700">
                    {creationDisplayDate.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {/* 第二行：客户和订单类型 */}
              <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 客户名称 */}
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        客户名称 <span className="text-red-500">*</span>
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
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* 订单类型 */}
                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm font-medium text-gray-700">
                        订单类型 <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="flex flex-row space-x-8 pt-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="NORMAL" id="normal" />
                            <Label
                              htmlFor="normal"
                              className="cursor-pointer text-sm font-normal"
                            >
                              正常销售
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="TRANSFER" id="transfer" />
                            <Label
                              htmlFor="transfer"
                              className="cursor-pointer text-sm font-normal"
                            >
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
                <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50/50 p-4">
                  <h4 className="mb-4 text-sm font-semibold text-orange-800">
                    调货销售信息
                  </h4>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* 供应商选择 */}
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            供应商/调出方{' '}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                            disabled={suppliersLoading}
                          >
                            <FormControl>
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="请选择供应商" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {suppliersData?.data?.map(supplier => (
                                <SelectItem key={supplier.id} value={supplier.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">
                                      {supplier.name}
                                    </span>
                                    {supplier.phone && (
                                      <span className="text-xs text-gray-500">
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

                    {/* 成本金额 */}
                    <FormField
                      control={form.control}
                      name="costAmount"
                      render={({ field }) => (
                        <FormItem className="space-y-2">
                          <FormLabel className="text-sm font-medium text-gray-700">
                            成本金额 <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              className="h-10 text-sm"
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
                </div>
              )}

            </div>
          </div>

          {/* ERP标准布局：订单明细表格 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 flex items-center justify-between border-b px-3 py-2">
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
              <div className="text-muted-foreground py-8 text-center">
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
                      <TableHead className="h-8 text-xs">商品名称</TableHead>
                      <TableHead className="h-8 text-xs">产品编码</TableHead>
                      <TableHead className="h-8 text-xs">每件片数</TableHead>
                      <TableHead className="h-8 text-xs">批次号</TableHead>
                      <TableHead className="h-8 text-xs">规格</TableHead>
                      <TableHead className="h-8 text-xs">单位</TableHead>
                      <TableHead className="h-8 text-xs">数量</TableHead>
                      <TableHead className="h-8 text-xs">单价</TableHead>
                      {form.watch('orderType') === 'TRANSFER' && (
                        <TableHead className="h-8 text-xs">成本单价</TableHead>
                      )}
                      <TableHead className="h-8 text-xs">金额</TableHead>
                      <TableHead className="h-8 text-xs">备注</TableHead>
                      <TableHead className="h-8 text-xs">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <OrderItemRow
                        key={field.id}
                        index={index}
                        products={productsData?.data || []}
                        onRemove={remove}
                        onProductChange={(idx, product) => {
                          if (product) {
                            // 自动填充产品相关信息
                            form.setValue(
                              `items.${idx}.specification`,
                              product.specification || ''
                            );
                            form.setValue(
                              `items.${idx}.unit`,
                              UNIT_MAPPING[product.unit?.toLowerCase() || ''] ||
                                product.unit ||
                                ''
                            );
                            form.setValue(
                              `items.${idx}.productCode`,
                              product.code || ''
                            );
                            form.setValue(
                              `items.${idx}.piecesPerUnit`,
                              product.piecesPerUnit || undefined
                            );
                            // 初始化新的单位和数量字段
                            form.setValue(`items.${idx}.displayUnit`, '片');
                            form.setValue(`items.${idx}.displayQuantity`, 1);
                            form.setValue(`items.${idx}.quantity`, 1);
                            // 清空备注
                            form.setValue(`items.${idx}.remarks`, '');

                            // 自动填充历史价格（基于产品编码匹配）
                            if (selectedCustomerId && priceHistoryData?.data && product.code) {
                              const latestPrice = getLatestPrice(
                                priceHistoryData.data,
                                product.code,
                                priceType
                              );
                              if (latestPrice !== undefined) {
                                form.setValue(
                                  `items.${idx}.unitPrice`,
                                  latestPrice
                                );
                                toast({
                                  title: '已自动填充历史价格',
                                  description: `产品编码 "${product.code}" 的上次价格：¥${latestPrice}`,
                                  duration: 2000,
                                });
                              }
                            }
                          }
                        }}
                        orderType={orderType}
                        unitMapping={UNIT_MAPPING}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* ERP标准布局：汇总信息 */}
          <div className="bg-card rounded border">
            <div className="bg-muted/30 border-b px-3 py-2">
              <h3 className="text-sm font-medium">汇总信息</h3>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
                    商品种类
                  </span>
                  <span className="text-sm font-semibold text-blue-600">
                    {fields.length} 种
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-green-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总数量</span>
                  <span className="text-sm font-semibold text-green-600">
                    {watchedItems.reduce(
                      (sum, item) => sum + (item.quantity || 0),
                      0
                    ).toLocaleString('zh-CN', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}{' '}
                    片
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-purple-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">总重量</span>
                  <span className="text-sm font-semibold text-purple-600">
                    {formatWeight(totalWeight)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded border bg-orange-50/50 px-3 py-2">
                  <span className="text-muted-foreground text-xs">
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
                  <div className="flex items-center justify-between rounded border bg-blue-50/50 px-3 py-2">
                    <span className="text-muted-foreground text-xs">总成本</span>
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
                )}
              </div>
            </div>
          </div>

          {/* 库存检查 */}
          {watchedItems.length > 0 && (
            <InventoryChecker
              items={inventoryCheckItems}
              products={productsData?.data || []}
              onInventoryCheck={results => {
                // 处理库存检查结果
              }}
            />
          )}

          {/* ERP标准布局：操作按钮 */}
          <div className="bg-card sticky bottom-0 rounded border p-3">
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
                  type="button"
                  variant="outline"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('draft')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '更新草稿' : '保存草稿'}
                </Button>
                <Button
                  type="button"
                  disabled={
                    createMutation.isPending ||
                    updateMutation.isPending ||
                    fields.length === 0 ||
                    !form.watch('customerId')
                  }
                  className="h-8 text-xs"
                  onClick={() => submitWithStatus('confirmed')}
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3 w-3" />
                  )}
                  {mode === 'edit' ? '更新并确认' : '提交订单'}
                </Button>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                保存草稿：可随时修改；提交订单：确认后进入处理流程
              </p>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}

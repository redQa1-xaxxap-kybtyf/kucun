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
    Palette,
    Save,
    TrendingDown,
    TrendingUp
} from 'lucide-react';
import { useState } from 'react';

// UI Components
import { useForm } from 'react-hook-form';

import { CustomerSelector } from '@/components/customers/customer-hierarchy';
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
import { Textarea } from '@/components/ui/textarea';

// Icons

// Custom Components

// API and Types
import {
    adjustInventory,
    checkInventoryAvailability,
    createInbound,
    createOutbound,
    inventoryQueryKeys,
} from '@/lib/api/inventory';
import { getProduct } from '@/lib/api/products';
import type {
    InboundRecord,
    Inventory,
    OutboundRecord,
} from '@/lib/types/inventory';
import {
    INBOUND_TYPE_LABELS,
    OUTBOUND_TYPE_LABELS,
} from '@/lib/types/inventory';
import { COMMON_COLOR_CODES } from '@/lib/types/sales-order';
import type {
    InboundCreateFormData,
    InventoryAdjustFormData,
    OutboundCreateFormData
} from '@/lib/validations/inventory';
import {
    inboundCreateDefaults,
    inboundCreateSchema,
    inventoryAdjustDefaults,
    inventoryAdjustSchema,
    outboundCreateDefaults,
    outboundCreateSchema,
} from '@/lib/validations/inventory';

import { ProductSelector } from '@/components/products/product-selector';

interface InventoryOperationFormProps {
  mode: 'inbound' | 'outbound' | 'adjust';
  onSuccess?: (result: InboundRecord | OutboundRecord | Inventory) => void;
  onCancel?: () => void;
}

export function InventoryOperationForm({
  mode,
  onSuccess,
  onCancel,
}: InventoryOperationFormProps) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');
  const [availabilityCheck, setAvailabilityCheck] = useState<{
    available: boolean;
    currentQuantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    message?: string;
  } | null>(null);

  // 表单配置
  const getFormConfig = () => {
    switch (mode) {
      case 'inbound':
        return {
          schema: inboundCreateSchema,
          defaults: inboundCreateDefaults,
          title: '库存入库',
          description: '增加产品库存数量',
          icon: TrendingUp,
        };
      case 'outbound':
        return {
          schema: outboundCreateSchema,
          defaults: outboundCreateDefaults,
          title: '库存出库',
          description: '减少产品库存数量',
          icon: TrendingDown,
        };
      case 'adjust':
        return {
          schema: inventoryAdjustSchema,
          defaults: inventoryAdjustDefaults,
          title: '库存调整',
          description: '调整产品库存数量',
          icon: Package,
        };
    }
  };

  const formConfig = getFormConfig();
  const IconComponent = formConfig.icon;

  const form = useForm<
    InboundCreateFormData | OutboundCreateFormData | InventoryAdjustFormData
  >({
    resolver: zodResolver(formConfig.schema),
    defaultValues: formConfig.defaults as any,
  });

  // 监听产品变化
  const watchedProductId = form.watch('productId');
  const watchedColorCode = form.watch('colorCode');
  const watchedProductionDate = form.watch('productionDate');
  const watchedQuantity = form.watch('quantity' as any);

  // 获取产品信息
  const { data: productData } = useQuery({
    queryKey: ['products', 'detail', watchedProductId],
    queryFn: () => getProduct(watchedProductId),
    enabled: !!watchedProductId,
  });

  // 检查库存可用性（仅出库时）
  const { data: availabilityData, refetch: checkAvailability } = useQuery({
    queryKey: [
      'inventory',
      'availability',
      watchedProductId,
      watchedColorCode,
      watchedProductionDate,
      watchedQuantity,
    ],
    queryFn: () =>
      checkInventoryAvailability(
        watchedProductId,
        watchedQuantity || 0,
        watchedColorCode || undefined,
        watchedProductionDate || undefined
      ),
    enabled:
      mode === 'outbound' &&
      !!watchedProductId &&
      !!watchedQuantity &&
      watchedQuantity > 0,
    staleTime: 10000, // 10秒缓存
  });

  // 入库 Mutation
  const inboundMutation = useMutation({
    mutationFn: createInbound,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.inboundRecords(),
      });
      if (onSuccess) {
        onSuccess(response);
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '入库操作失败');
    },
  });

  // 出库 Mutation
  const outboundMutation = useMutation({
    mutationFn: createOutbound,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: inventoryQueryKeys.outboundRecords(),
      });
      if (onSuccess) {
        onSuccess(response);
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '出库操作失败');
    },
  });

  // 调整 Mutation
  const adjustMutation = useMutation({
    mutationFn: adjustInventory,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() });
      if (onSuccess) {
        onSuccess(response);
      }
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '库存调整失败');
    },
  });

  const isLoading =
    inboundMutation.isPending ||
    outboundMutation.isPending ||
    adjustMutation.isPending;

  // 表单提交
  const onSubmit = async (data: any) => {
    setSubmitError('');

    try {
      switch (mode) {
        case 'inbound':
          await inboundMutation.mutateAsync(data as InboundCreateFormData);
          break;
        case 'outbound':
          await outboundMutation.mutateAsync(data as OutboundCreateFormData);
          break;
        case 'adjust':
          await adjustMutation.mutateAsync(data as InventoryAdjustFormData);
          break;
      }
    } catch (error) {
      // 错误已在 mutation 的 onError 中处理
    }
  };

  // 获取操作类型选项
  const getTypeOptions = () => {
    switch (mode) {
      case 'inbound':
        return Object.entries(INBOUND_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }));
      case 'outbound':
        return Object.entries(OUTBOUND_TYPE_LABELS).map(([value, label]) => ({
          value,
          label,
        }));
      default:
        return [];
    }
  };

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
              <IconComponent className="mr-3 h-8 w-8" />
              {formConfig.title}
            </h1>
            <p className="text-muted-foreground">{formConfig.description}</p>
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

      {/* 库存可用性检查结果 */}
      {mode === 'outbound' && availabilityData && (
        <Alert
          variant={availabilityData.available ? 'default' : 'destructive'}
        >
          <Package className="h-4 w-4" />
          <AlertDescription>
            {availabilityData.available
              ? `库存充足：当前库存 ${availabilityData.currentStock}`
              : availabilityData.message || '库存不足，无法完成出库操作'}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="mr-2 h-5 w-5" />
                基础信息
              </CardTitle>
              <CardDescription>选择产品和操作类型</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 操作类型 */}
                {mode !== 'adjust' && (
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>操作类型 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择操作类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getTypeOptions().map(option => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* 产品选择 */}
                <div className={mode === 'adjust' ? 'md:col-span-2' : ''}>
                  <ProductSelector
                    label="选择产品 *"
                    placeholder="搜索产品..."
                    disabled={isLoading}
                    onValueChange={() => {}}
                  />
                </div>
              </div>

              {/* 产品规格 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 色号 */}
                <FormField
                  control={form.control}
                  name="colorCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Palette className="mr-1 h-4 w-4" />
                        色号
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择色号" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">无色号</SelectItem>
                          {COMMON_COLOR_CODES.map(color => (
                            <SelectItem key={color.value} value={color.value}>
                              {color.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 生产日期 */}
                <FormField
                  control={form.control}
                  name="productionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Calendar className="mr-1 h-4 w-4" />
                        生产日期
                      </FormLabel>
                      <FormControl>
                        <Input type="date" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 数量 */}
                <FormField
                  control={form.control}
                  name={mode === 'adjust' ? 'adjustQuantity' : 'quantity'}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Calculator className="mr-1 h-4 w-4" />
                        {mode === 'adjust' ? '调整数量 *' : '数量 *'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={mode === 'adjust' ? -999999 : 1}
                          max="999999"
                          disabled={isLoading}
                          placeholder={
                            mode === 'adjust'
                              ? '正数增加，负数减少'
                              : '请输入数量'
                          }
                          {...field}
                          onChange={e => {
                            const value = e.target.value;
                            field.onChange(value ? parseInt(value) : 0);
                          }}
                        />
                      </FormControl>
                      {mode === 'adjust' && (
                        <FormDescription>
                          正数表示增加库存，负数表示减少库存
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 产品信息显示 */}
              {productData && (
                <div className="rounded-md bg-muted/50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span>
                        <strong>产品编码:</strong> {productData.code}
                      </span>
                      <span>
                        <strong>规格:</strong>{' '}
                        {productData.specification || '无'}
                      </span>
                      <span>
                        <strong>单位:</strong> {productData.unit}
                      </span>
                    </div>
                    {productData.status === 'inactive' && (
                      <Badge variant="destructive">已停用</Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 成本和关联信息 */}
          {mode !== 'adjust' && (
            <Card>
              <CardHeader>
                <CardTitle>成本和关联信息</CardTitle>
                <CardDescription>填写成本信息和相关业务关联</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 单位成本 */}
                  <FormField
                    control={form.control}
                    name="unitCost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>单位成本 (元)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="999999.99"
                            disabled={isLoading}
                            placeholder="0.00"
                            {...field}
                            onChange={e => {
                              const value = e.target.value;
                              field.onChange(
                                value ? parseFloat(value) : undefined
                              );
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 供应商（入库）或客户（出库） */}
                  {mode === 'inbound' ? (
                    <FormField
                      control={form.control}
                      name="supplierId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center">
                            <Building2 className="mr-1 h-4 w-4" />
                            供应商
                          </FormLabel>
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
                              <SelectItem value="none">无供应商</SelectItem>
                              {/* 这里应该显示供应商列表，简化处理 */}
                              <SelectItem value="supplier-1">
                                示例供应商 1
                              </SelectItem>
                              <SelectItem value="supplier-2">
                                示例供应商 2
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <CustomerSelector
                      control={form.control}
                      name="customerId"
                      label="客户"
                      placeholder="选择客户..."
                      disabled={isLoading}
                    />
                  )}
                </div>

                {/* 销售订单（出库） */}
                {mode === 'outbound' && (
                  <FormField
                    control={form.control}
                    name="salesOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>关联销售订单</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isLoading}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择销售订单" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">无关联订单</SelectItem>
                            {/* 这里应该显示销售订单列表，简化处理 */}
                            <SelectItem value="order-1">
                              SO20250116001
                            </SelectItem>
                            <SelectItem value="order-2">
                              SO20250116002
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          选择相关的销售订单，用于业务关联
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* 调整原因（仅调整时） */}
          {mode === 'adjust' && (
            <Card>
              <CardHeader>
                <CardTitle>调整原因</CardTitle>
                <CardDescription>说明库存调整的原因</CardDescription>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>调整原因 *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="请详细说明库存调整的原因..."
                          className="min-h-[80px]"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        请详细说明调整原因，便于后续审计和追踪
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* 备注信息 */}
          <Card>
            <CardHeader>
              <CardTitle>备注信息</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="其他备注信息..."
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
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              确认
              {mode === 'inbound'
                ? '入库'
                : mode === 'outbound'
                  ? '出库'
                  : '调整'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

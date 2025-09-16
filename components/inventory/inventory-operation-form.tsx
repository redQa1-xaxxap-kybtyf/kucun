'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

// Icons
import { 
  Save, 
  ArrowLeft, 
  Package, 
  AlertCircle, 
  Loader2, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Palette,
  Calculator,
  Building2,
  User
} from 'lucide-react'

// Custom Components
import { ProductSelector } from '@/components/products/product-selector'
import { CustomerSelector } from '@/components/customers/customer-hierarchy'

// API and Types
import { 
  createInbound, 
  createOutbound, 
  adjustInventory,
  checkInventoryAvailability,
  inventoryQueryKeys 
} from '@/lib/api/inventory'
import { getProduct } from '@/lib/api/products'
import { InboundRecord, OutboundRecord, Inventory } from '@/lib/types/inventory'
import { 
  inboundCreateSchema, 
  outboundCreateSchema, 
  inventoryAdjustSchema,
  InboundCreateFormData, 
  OutboundCreateFormData,
  InventoryAdjustFormData,
  inboundCreateDefaults,
  outboundCreateDefaults,
  inventoryAdjustDefaults
} from '@/lib/validations/inventory'
import {
  INBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_LABELS
} from '@/lib/types/inventory'
import { COMMON_COLOR_CODES } from '@/lib/types/sales-order'

interface InventoryOperationFormProps {
  mode: 'inbound' | 'outbound' | 'adjust'
  onSuccess?: (result: InboundRecord | OutboundRecord | Inventory) => void
  onCancel?: () => void
}

export function InventoryOperationForm({ mode, onSuccess, onCancel }: InventoryOperationFormProps) {
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string>('')
  const [availabilityCheck, setAvailabilityCheck] = useState<{
    available: boolean
    currentQuantity: number
    reservedQuantity: number
    availableQuantity: number
    message?: string
  } | null>(null)

  // 表单配置
  const getFormConfig = () => {
    switch (mode) {
      case 'inbound':
        return {
          schema: inboundCreateSchema,
          defaults: inboundCreateDefaults,
          title: '库存入库',
          description: '增加产品库存数量',
          icon: TrendingUp
        }
      case 'outbound':
        return {
          schema: outboundCreateSchema,
          defaults: outboundCreateDefaults,
          title: '库存出库',
          description: '减少产品库存数量',
          icon: TrendingDown
        }
      case 'adjust':
        return {
          schema: inventoryAdjustSchema,
          defaults: inventoryAdjustDefaults,
          title: '库存调整',
          description: '调整产品库存数量',
          icon: Package
        }
    }
  }

  const formConfig = getFormConfig()
  const IconComponent = formConfig.icon

  const form = useForm<InboundCreateFormData | OutboundCreateFormData | InventoryAdjustFormData>({
    resolver: zodResolver(formConfig.schema),
    defaultValues: formConfig.defaults as any
  })

  // 监听产品变化
  const watchedProductId = form.watch('productId')
  const watchedColorCode = form.watch('colorCode')
  const watchedProductionDate = form.watch('productionDate')
  const watchedQuantity = form.watch('quantity' as any)

  // 获取产品信息
  const { data: productData } = useQuery({
    queryKey: ['products', 'detail', watchedProductId],
    queryFn: () => getProduct(watchedProductId),
    enabled: !!watchedProductId,
  })

  // 检查库存可用性（仅出库时）
  const { data: availabilityData, refetch: checkAvailability } = useQuery({
    queryKey: ['inventory', 'availability', watchedProductId, watchedColorCode, watchedProductionDate, watchedQuantity],
    queryFn: () => checkInventoryAvailability(
      watchedProductId,
      watchedQuantity || 0,
      watchedColorCode || undefined,
      watchedProductionDate || undefined
    ),
    enabled: mode === 'outbound' && !!watchedProductId && !!watchedQuantity && watchedQuantity > 0,
    staleTime: 10000, // 10秒缓存
  })

  // 入库 Mutation
  const inboundMutation = useMutation({
    mutationFn: createInbound,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.inboundRecords() })
      if (onSuccess) {
        onSuccess(response.data)
      }
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : '入库操作失败')
    }
  })

  // 出库 Mutation
  const outboundMutation = useMutation({
    mutationFn: createOutbound,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.outboundRecords() })
      if (onSuccess) {
        onSuccess(response.data)
      }
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : '出库操作失败')
    }
  })

  // 调整 Mutation
  const adjustMutation = useMutation({
    mutationFn: adjustInventory,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: inventoryQueryKeys.lists() })
      if (onSuccess) {
        onSuccess(response.data)
      }
    },
    onError: (error) => {
      setSubmitError(error instanceof Error ? error.message : '库存调整失败')
    }
  })

  const isLoading = inboundMutation.isPending || outboundMutation.isPending || adjustMutation.isPending

  // 表单提交
  const onSubmit = async (data: any) => {
    setSubmitError('')
    
    try {
      switch (mode) {
        case 'inbound':
          await inboundMutation.mutateAsync(data as InboundCreateFormData)
          break
        case 'outbound':
          await outboundMutation.mutateAsync(data as OutboundCreateFormData)
          break
        case 'adjust':
          await adjustMutation.mutateAsync(data as InventoryAdjustFormData)
          break
      }
    } catch (error) {
      // 错误已在 mutation 的 onError 中处理
    }
  }

  // 获取操作类型选项
  const getTypeOptions = () => {
    switch (mode) {
      case 'inbound':
        return Object.entries(INBOUND_TYPE_LABELS).map(([value, label]) => ({
          value,
          label
        }))
      case 'outbound':
        return Object.entries(OUTBOUND_TYPE_LABELS).map(([value, label]) => ({
          value,
          label
        }))
      default:
        return []
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <IconComponent className="h-8 w-8 mr-3" />
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
      {mode === 'outbound' && availabilityData?.data && (
        <Alert variant={availabilityData.data.available ? 'default' : 'destructive'}>
          <Package className="h-4 w-4" />
          <AlertDescription>
            {availabilityData.data.available ? (
              `库存充足：当前库存 ${availabilityData.data.currentQuantity}，预留 ${availabilityData.data.reservedQuantity}，可用 ${availabilityData.data.availableQuantity}`
            ) : (
              availabilityData.data.message || '库存不足，无法完成出库操作'
            )}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                基础信息
              </CardTitle>
              <CardDescription>
                选择产品和操作类型
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 操作类型 */}
                {mode !== 'adjust' && (
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>操作类型 *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择操作类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {getTypeOptions().map(option => (
                              <SelectItem key={option.value} value={option.value}>
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
                    control={form.control}
                    name="productId"
                    label="选择产品 *"
                    placeholder="搜索产品..."
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* 产品规格 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 色号 */}
                <FormField
                  control={form.control}
                  name="colorCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Palette className="h-4 w-4 mr-1" />
                        色号
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
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
                        <Calendar className="h-4 w-4 mr-1" />
                        生产日期
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          disabled={isLoading}
                          {...field}
                        />
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
                        <Calculator className="h-4 w-4 mr-1" />
                        {mode === 'adjust' ? '调整数量 *' : '数量 *'}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={mode === 'adjust' ? -999999 : 1}
                          max="999999"
                          disabled={isLoading}
                          placeholder={mode === 'adjust' ? '正数增加，负数减少' : '请输入数量'}
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value ? parseInt(value) : 0)
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
              {productData?.data && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span><strong>产品编码:</strong> {productData.data.code}</span>
                      <span><strong>规格:</strong> {productData.data.specification || '无'}</span>
                      <span><strong>单位:</strong> {productData.data.unit}</span>
                    </div>
                    {productData.data.status === 'inactive' && (
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
                <CardDescription>
                  填写成本信息和相关业务关联
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            onChange={(e) => {
                              const value = e.target.value
                              field.onChange(value ? parseFloat(value) : undefined)
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
                            <Building2 className="h-4 w-4 mr-1" />
                            供应商
                          </FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择供应商" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">无供应商</SelectItem>
                              {/* 这里应该显示供应商列表，简化处理 */}
                              <SelectItem value="supplier-1">示例供应商 1</SelectItem>
                              <SelectItem value="supplier-2">示例供应商 2</SelectItem>
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择销售订单" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">无关联订单</SelectItem>
                            {/* 这里应该显示销售订单列表，简化处理 */}
                            <SelectItem value="order-1">SO20250116001</SelectItem>
                            <SelectItem value="order-2">SO20250116002</SelectItem>
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
                <CardDescription>
                  说明库存调整的原因
                </CardDescription>
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
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              确认{mode === 'inbound' ? '入库' : mode === 'outbound' ? '出库' : '调整'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

// 简化的产品选择器组件（实际应该从产品管理模块导入）
interface ProductSelectorProps {
  control: any
  name: string
  label?: string
  placeholder?: string
  disabled?: boolean
}

function ProductSelector({
  control,
  name,
  label = '选择产品',
  placeholder = '搜索产品...',
  disabled = false
}: ProductSelectorProps) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="none">请选择产品</SelectItem>
              {/* 这里应该显示产品列表，简化处理 */}
              <SelectItem value="product-1">示例产品 1</SelectItem>
              <SelectItem value="product-2">示例产品 2</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

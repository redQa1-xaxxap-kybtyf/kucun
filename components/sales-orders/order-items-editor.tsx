'use client'

import { useState } from 'react'
import { Control, useFieldArray, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'

// Icons
import { Plus, Trash2, Package, Calculator, AlertCircle, Calendar } from 'lucide-react'

// Custom Components
import { ProductSelector } from '@/components/products/product-selector'

// API and Types
import { getProducts, productQueryKeys } from '@/lib/api/products'
import { Product } from '@/lib/types/product'
import { 
  SalesOrderItemCreateFormData,
  SalesOrderItemUpdateFormData,
  calculateItemSubtotal,
  calculateOrderTotal,
  COMMON_COLOR_CODES
} from '@/lib/validations/sales-order'

// 订单明细编辑器属性
interface OrderItemsEditorProps {
  control: Control<any>
  name: string
  disabled?: boolean
  mode?: 'create' | 'edit'
}

// 订单明细编辑器组件
export function OrderItemsEditor({ control, name, disabled = false, mode = 'create' }: OrderItemsEditorProps) {
  const { fields, append, remove, update } = useFieldArray({
    control,
    name,
  })

  // 监听订单明细变化以计算总金额
  const watchedItems = useWatch({
    control,
    name,
  }) as (SalesOrderItemCreateFormData | SalesOrderItemUpdateFormData)[]

  // 计算订单总金额
  const orderTotal = calculateOrderTotal(watchedItems || [])

  // 添加新明细
  const addNewItem = () => {
    append({
      productId: '',
      colorCode: '',
      productionDate: '',
      quantity: 1,
      unitPrice: 0,
    })
  }

  // 删除明细
  const removeItem = (index: number) => {
    if (mode === 'edit' && fields[index].id) {
      // 编辑模式下，标记为删除而不是直接移除
      update(index, {
        ...fields[index],
        _action: 'delete'
      })
    } else {
      remove(index)
    }
  }

  // 恢复已删除的明细
  const restoreItem = (index: number) => {
    update(index, {
      ...fields[index],
      _action: undefined
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            订单明细
          </span>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-muted-foreground">
              共 {fields.filter(field => !field._action || field._action !== 'delete').length} 项
            </div>
            <Badge variant="outline" className="text-base font-medium">
              <Calculator className="h-4 w-4 mr-1" />
              总计：¥{orderTotal.toLocaleString()}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription>
          添加订单中的产品明细，支持瓷砖行业特有的色号和生产日期管理
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="mb-4">还没有添加任何产品</p>
            <Button onClick={addNewItem} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              添加产品
            </Button>
          </div>
        ) : (
          <>
            {/* 明细列表 */}
            <div className="space-y-4">
              {fields.map((field, index) => {
                const isDeleted = field._action === 'delete'
                
                return (
                  <OrderItemRow
                    key={field.id}
                    control={control}
                    name={`${name}.${index}`}
                    index={index}
                    onRemove={() => removeItem(index)}
                    onRestore={() => restoreItem(index)}
                    disabled={disabled}
                    isDeleted={isDeleted}
                    mode={mode}
                  />
                )
              })}
            </div>

            <Separator />

            {/* 操作按钮 */}
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                onClick={addNewItem}
                disabled={disabled}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加产品
              </Button>

              <div className="text-right">
                <div className="text-sm text-muted-foreground mb-1">订单总金额</div>
                <div className="text-2xl font-bold text-primary">
                  ¥{orderTotal.toLocaleString()}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// 订单明细行组件属性
interface OrderItemRowProps {
  control: Control<any>
  name: string
  index: number
  onRemove: () => void
  onRestore: () => void
  disabled?: boolean
  isDeleted?: boolean
  mode?: 'create' | 'edit'
}

// 订单明细行组件
function OrderItemRow({ 
  control, 
  name, 
  index, 
  onRemove, 
  onRestore, 
  disabled = false, 
  isDeleted = false,
  mode = 'create'
}: OrderItemRowProps) {
  // 监听当前行的数据变化
  const watchedItem = useWatch({
    control,
    name,
  }) as SalesOrderItemCreateFormData | SalesOrderItemUpdateFormData

  // 获取选中产品的信息
  const { data: productData } = useQuery({
    queryKey: ['products', 'detail', watchedItem?.productId],
    queryFn: async () => {
      if (!watchedItem?.productId) return null
      const response = await fetch(`/api/products/${watchedItem.productId}`)
      if (!response.ok) return null
      const result = await response.json()
      return result.data as Product
    },
    enabled: !!watchedItem?.productId,
  })

  // 计算小计
  const subtotal = watchedItem ? calculateItemSubtotal(watchedItem.quantity || 0, watchedItem.unitPrice || 0) : 0

  // 自动设置产品单价
  const handleProductChange = (productId: string) => {
    // 这里可以根据产品信息自动设置单价
    // 实际应用中可能需要根据客户、产品等因素动态计算价格
  }

  if (isDeleted) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Badge variant="destructive">已删除</Badge>
              <span className="text-sm text-muted-foreground line-through">
                {productData?.name || '未知产品'}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRestore}
              disabled={disabled}
            >
              恢复
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-muted">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          {/* 产品选择 */}
          <div className="lg:col-span-4">
            <ProductSelector
              control={control}
              name={`${name}.productId`}
              label="选择产品"
              placeholder="搜索产品..."
              disabled={disabled}
              onProductChange={handleProductChange}
            />
          </div>

          {/* 色号 */}
          <div className="lg:col-span-2">
            <FormField
              control={control}
              name={`${name}.colorCode`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>色号</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={disabled}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择色号" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">无色号</SelectItem>
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
          </div>

          {/* 生产日期 */}
          <div className="lg:col-span-2">
            <FormField
              control={control}
              name={`${name}.productionDate`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    生产日期
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={disabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 数量 */}
          <div className="lg:col-span-1">
            <FormField
              control={control}
              name={`${name}.quantity`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>数量</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="999999.99"
                      disabled={disabled}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value
                        field.onChange(value ? parseFloat(value) : 0)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 单价 */}
          <div className="lg:col-span-2">
            <FormField
              control={control}
              name={`${name}.unitPrice`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>单价 (元)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="999999.99"
                      disabled={disabled}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value
                        field.onChange(value ? parseFloat(value) : 0)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* 小计和操作 */}
          <div className="lg:col-span-1 flex items-center justify-between">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">小计</div>
              <div className="font-medium">¥{subtotal.toLocaleString()}</div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRemove}
              disabled={disabled}
              className="ml-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 产品信息显示 */}
        {productData && (
          <div className="mt-3 p-3 bg-muted/50 rounded-md">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span><strong>产品编码:</strong> {productData.code}</span>
                <span><strong>规格:</strong> {productData.specification || '无'}</span>
                <span><strong>单位:</strong> {productData.unit}</span>
                {productData.piecesPerUnit > 1 && (
                  <span><strong>每件片数:</strong> {productData.piecesPerUnit}</span>
                )}
              </div>
              {productData.status === 'inactive' && (
                <Badge variant="destructive">已停用</Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// 产品选择器组件（简化版，实际应该从产品管理模块导入）
interface ProductSelectorProps {
  control: Control<any>
  name: string
  label?: string
  placeholder?: string
  disabled?: boolean
  onProductChange?: (productId: string) => void
}

function ProductSelector({
  control,
  name,
  label = '选择产品',
  placeholder = '搜索产品...',
  disabled = false,
  onProductChange
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // 搜索产品
  const { data: searchResults, isLoading } = useQuery({
    queryKey: productQueryKeys.list({ search: searchQuery, limit: 20 }),
    queryFn: () => getProducts({ search: searchQuery, limit: 20 }),
    enabled: searchQuery.length > 0,
    staleTime: 30000,
  })

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select 
            onValueChange={(value) => {
              field.onChange(value)
              onProductChange?.(value)
            }} 
            value={field.value} 
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="">请选择产品</SelectItem>
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

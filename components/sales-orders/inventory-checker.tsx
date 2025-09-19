"use client"

import * as React from "react"
import { AlertTriangle, CheckCircle, Package, XCircle } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { Product } from "@/lib/types/product"

interface InventoryItem {
  productId: string
  quantity: number
  colorCode?: string
  productionDate?: string
}

interface InventoryCheckResult {
  productId: string
  product?: Product
  requestedQuantity: number
  availableQuantity: number
  isAvailable: boolean
  isLowStock: boolean
  message: string
  severity: "success" | "warning" | "error"
}

interface InventoryCheckerProps {
  items: InventoryItem[]
  products: Product[]
  onInventoryCheck?: (results: InventoryCheckResult[]) => void
  className?: string
}

/**
 * 库存检查组件
 * 实时检查订单项的库存可用性
 */
export function InventoryChecker({
  items,
  products,
  onInventoryCheck,
  className,
}: InventoryCheckerProps) {
  const [checkResults, setCheckResults] = React.useState<InventoryCheckResult[]>([])

  // 执行库存检查
  const performInventoryCheck = React.useCallback(() => {
    const results: InventoryCheckResult[] = items.map(item => {
      const product = products.find(p => p.id === item.productId)
      
      if (!product) {
        return {
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: 0,
          isAvailable: false,
          isLowStock: false,
          message: "产品不存在",
          severity: "error" as const,
        }
      }

      const availableQuantity = product.inventory?.availableInventory || 0
      const isAvailable = availableQuantity >= item.quantity
      const isLowStock = availableQuantity > 0 && availableQuantity <= 10
      
      let message = ""
      let severity: "success" | "warning" | "error" = "success"

      if (!isAvailable) {
        message = `库存不足！需要 ${item.quantity}${product.unit}，可用 ${availableQuantity}${product.unit}`
        severity = "error"
      } else if (isLowStock) {
        message = `库存预警！剩余 ${availableQuantity}${product.unit}`
        severity = "warning"
      } else {
        message = `库存充足，剩余 ${availableQuantity}${product.unit}`
        severity = "success"
      }

      return {
        productId: item.productId,
        product,
        requestedQuantity: item.quantity,
        availableQuantity,
        isAvailable,
        isLowStock,
        message,
        severity,
      }
    })

    setCheckResults(results)
    onInventoryCheck?.(results)
  }, [items, products, onInventoryCheck])

  // 当订单项或产品列表变化时重新检查
  React.useEffect(() => {
    if (items.length > 0 && products.length > 0) {
      performInventoryCheck()
    }
  }, [items, products, performInventoryCheck])

  // 统计信息
  const stats = React.useMemo(() => {
    const total = checkResults.length
    const available = checkResults.filter(r => r.isAvailable).length
    const warnings = checkResults.filter(r => r.severity === "warning").length
    const errors = checkResults.filter(r => r.severity === "error").length

    return { total, available, warnings, errors }
  }, [checkResults])

  if (items.length === 0) {
    return null
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          库存检查
        </CardTitle>
        <CardDescription>
          实时检查订单商品的库存可用性
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 统计概览 */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">总商品</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            <div className="text-xs text-muted-foreground">库存充足</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.warnings}</div>
            <div className="text-xs text-muted-foreground">库存预警</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.errors}</div>
            <div className="text-xs text-muted-foreground">库存不足</div>
          </div>
        </div>

        {/* 整体状态 */}
        {stats.errors > 0 && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              有 {stats.errors} 个商品库存不足，无法完成订单
            </AlertDescription>
          </Alert>
        )}

        {stats.errors === 0 && stats.warnings > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              有 {stats.warnings} 个商品库存偏低，建议及时补货
            </AlertDescription>
          </Alert>
        )}

        {stats.errors === 0 && stats.warnings === 0 && stats.total > 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              所有商品库存充足，可以正常下单
            </AlertDescription>
          </Alert>
        )}

        {/* 详细检查结果 */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">详细检查结果</h4>
          <div className="space-y-2">
            {checkResults.map((result, index) => (
              <InventoryCheckItem key={`${result.productId}-${index}`} result={result} />
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={performInventoryCheck}
          >
            重新检查
          </Button>
          
          {stats.errors > 0 && (
            <Badge variant="destructive">
              无法下单
            </Badge>
          )}
          
          {stats.errors === 0 && stats.warnings > 0 && (
            <Badge variant="secondary">
              可以下单（有预警）
            </Badge>
          )}
          
          {stats.errors === 0 && stats.warnings === 0 && stats.total > 0 && (
            <Badge className="bg-green-100 text-green-800">
              可以下单
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 单个库存检查项组件
 */
interface InventoryCheckItemProps {
  result: InventoryCheckResult
}

function InventoryCheckItem({ result }: InventoryCheckItemProps) {
  const getIcon = () => {
    switch (result.severity) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const getProgressColor = () => {
    if (result.availableQuantity === 0) return "bg-red-500"
    if (result.availableQuantity <= 10) return "bg-orange-500"
    return "bg-green-500"
  }

  const progressValue = result.product
    ? Math.min((result.availableQuantity / Math.max(result.requestedQuantity, result.availableQuantity)) * 100, 100)
    : 0

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border",
      result.severity === "error" && "border-red-200 bg-red-50",
      result.severity === "warning" && "border-orange-200 bg-orange-50",
      result.severity === "success" && "border-green-200 bg-green-50"
    )}>
      {getIcon()}
      
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-medium text-sm">
            {result.product?.name || "未知产品"}
          </span>
          <Badge variant="outline" className="text-xs">
            {result.product?.code}
          </Badge>
        </div>
        
        <div className="text-xs text-muted-foreground">
          需要: {result.requestedQuantity}{result.product?.unit} | 
          可用: {result.availableQuantity}{result.product?.unit}
        </div>
        
        {result.product && (
          <div className="flex items-center gap-2">
            <Progress 
              value={progressValue} 
              className="flex-1 h-2"
            />
            <span className="text-xs font-medium">
              {progressValue.toFixed(0)}%
            </span>
          </div>
        )}
        
        <div className={cn(
          "text-xs",
          result.severity === "error" && "text-red-700",
          result.severity === "warning" && "text-orange-700",
          result.severity === "success" && "text-green-700"
        )}>
          {result.message}
        </div>
      </div>
    </div>
  )
}

/**
 * 简化的库存状态指示器
 */
interface InventoryStatusProps {
  product: Product
  requestedQuantity: number
  className?: string
}

export function InventoryStatus({ 
  product, 
  requestedQuantity, 
  className 
}: InventoryStatusProps) {
  const availableQuantity = product.inventory?.availableInventory || 0
  const isAvailable = availableQuantity >= requestedQuantity
  const isLowStock = availableQuantity > 0 && availableQuantity <= 10

  if (!isAvailable) {
    return (
      <Badge variant="destructive" className={className}>
        库存不足
      </Badge>
    )
  }

  if (isLowStock) {
    return (
      <Badge variant="secondary" className={cn("text-orange-600", className)}>
        库存预警
      </Badge>
    )
  }

  return (
    <Badge className={cn("bg-green-100 text-green-800", className)}>
      库存充足
    </Badge>
  )
}

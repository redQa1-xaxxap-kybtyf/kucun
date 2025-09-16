// 仪表盘库存预警组件
// 基于T11库存状态指示器组件的库存预警展示

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Package, 
  Clock,
  X,
  ExternalLink,
  RefreshCw
} from 'lucide-react'

// 使用T11组件库
import { 
  InventoryStatusIndicator,
  ColorCodeDisplay 
} from '@/components/ui/color-code-display'
import type { InventoryAlert } from '@/lib/types/dashboard'
import { dashboardUtils, useDismissAlert } from '@/lib/api/dashboard'

// 预警级别配置
const ALERT_LEVEL_CONFIG = {
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    badge: 'bg-yellow-100 text-yellow-800',
    label: '预警'
  },
  danger: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-800',
    label: '危险'
  },
  critical: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
    label: '紧急'
  }
} as const

// 预警类型配置
const ALERT_TYPE_CONFIG = {
  low_stock: {
    label: '库存不足',
    description: '库存低于安全库存',
    color: 'yellow'
  },
  out_of_stock: {
    label: '缺货',
    description: '库存为零',
    color: 'red'
  },
  overstock: {
    label: '库存过多',
    description: '库存超过最大库存',
    color: 'blue'
  },
  expired: {
    label: '过期',
    description: '产品已过期',
    color: 'gray'
  }
} as const

export interface InventoryAlertItemProps {
  alert: InventoryAlert
  onDismiss?: (alertId: string) => void
  onViewProduct?: (productId: string) => void
  compact?: boolean
  className?: string
}

const InventoryAlertItem = React.forwardRef<HTMLDivElement, InventoryAlertItemProps>(
  ({ alert, onDismiss, onViewProduct, compact = false, className, ...props }, ref) => {
    const levelConfig = ALERT_LEVEL_CONFIG[alert.alertLevel]
    const typeConfig = ALERT_TYPE_CONFIG[alert.alertType]
    const IconComponent = levelConfig.icon

    if (compact) {
      return (
        <div 
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            levelConfig.bg,
            levelConfig.border,
            className
          )}
          ref={ref}
          {...props}
        >
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <IconComponent className={cn("h-4 w-4 flex-shrink-0", levelConfig.color)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <p className="font-medium text-sm truncate">{alert.productName}</p>
                {alert.colorCode && (
                  <ColorCodeDisplay 
                    colorCode={alert.colorCode} 
                    size="sm" 
                    className="flex-shrink-0"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                库存: {alert.currentStock} / 安全: {alert.safetyStock}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Badge variant="outline" className={cn("text-xs", levelConfig.badge)}>
              {levelConfig.label}
            </Badge>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(alert.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div 
        className={cn(
          "p-4 rounded-lg border transition-colors",
          levelConfig.bg,
          levelConfig.border,
          className
        )}
        ref={ref}
        {...props}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 min-w-0 flex-1">
            <IconComponent className={cn("h-5 w-5 mt-0.5 flex-shrink-0", levelConfig.color)} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-sm">{alert.productName}</h4>
                {alert.colorCode && (
                  <ColorCodeDisplay colorCode={alert.colorCode} size="sm" />
                )}
                <Badge variant="outline" className={cn("text-xs", levelConfig.badge)}>
                  {typeConfig.label}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground">
                产品编码: {alert.productCode}
              </p>
              
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">当前库存:</span>
                  <span className="ml-1 font-medium">{alert.currentStock}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">安全库存:</span>
                  <span className="ml-1 font-medium">{alert.safetyStock}</span>
                </div>
              </div>
              
              {alert.daysUntilStockout && (
                <div className="flex items-center space-x-1 text-xs text-orange-600">
                  <Clock className="h-3 w-3" />
                  <span>预计 {alert.daysUntilStockout} 天后缺货</span>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                建议: {alert.suggestedAction}
              </p>
              
              <p className="text-xs text-muted-foreground">
                更新时间: {dashboardUtils.formatTimeAgo(alert.lastUpdated)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 flex-shrink-0">
            {onViewProduct && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewProduct(alert.productId)}
                className="text-xs"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                查看
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDismiss(alert.id)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }
)

InventoryAlertItem.displayName = "InventoryAlertItem"

export interface InventoryAlertsProps {
  alerts: InventoryAlert[]
  loading?: boolean
  onRefresh?: () => void
  onDismissAlert?: (alertId: string) => void
  onViewProduct?: (productId: string) => void
  maxHeight?: string
  showHeader?: boolean
  compact?: boolean
  className?: string
}

const InventoryAlerts = React.forwardRef<HTMLDivElement, InventoryAlertsProps>(
  ({ 
    alerts, 
    loading = false, 
    onRefresh, 
    onDismissAlert, 
    onViewProduct,
    maxHeight = "400px",
    showHeader = true,
    compact = false,
    className,
    ...props 
  }, ref) => {
    const dismissMutation = useDismissAlert()
    
    // 处理忽略预警
    const handleDismiss = (alertId: string) => {
      dismissMutation.mutate(alertId)
      onDismissAlert?.(alertId)
    }
    
    // 处理查看产品
    const handleViewProduct = (productId: string) => {
      onViewProduct?.(productId)
    }
    
    // 按预警级别排序
    const sortedAlerts = React.useMemo(() => {
      return [...alerts].sort((a, b) => {
        const levelOrder = { critical: 3, danger: 2, warning: 1 }
        return levelOrder[b.alertLevel] - levelOrder[a.alertLevel]
      })
    }, [alerts])
    
    // 统计信息
    const alertStats = React.useMemo(() => {
      const stats = { critical: 0, danger: 0, warning: 0, total: alerts.length }
      alerts.forEach(alert => {
        stats[alert.alertLevel]++
      })
      return stats
    }, [alerts])

    if (loading) {
      return (
        <Card className={className} ref={ref} {...props}>
          {showHeader && (
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            </CardHeader>
          )}
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-4 w-4" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-6 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )
    }

    return (
      <Card className={className} ref={ref} {...props}>
        {showHeader && (
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>库存预警</span>
                  {alertStats.total > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {alertStats.total}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {alertStats.critical > 0 && `${alertStats.critical} 紧急`}
                  {alertStats.danger > 0 && `${alertStats.danger > 0 && alertStats.critical > 0 ? ', ' : ''}${alertStats.danger} 危险`}
                  {alertStats.warning > 0 && `${(alertStats.critical > 0 || alertStats.danger > 0) ? ', ' : ''}${alertStats.warning} 预警`}
                  {alertStats.total === 0 && '暂无预警'}
                </CardDescription>
              </div>
              {onRefresh && (
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
        )}
        
        <CardContent>
          {sortedAlerts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无库存预警</p>
              <p className="text-sm text-muted-foreground mt-1">
                库存状态良好
              </p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }}>
              <div className={cn("space-y-3", compact && "space-y-2")}>
                {sortedAlerts.map((alert) => (
                  <InventoryAlertItem
                    key={alert.id}
                    alert={alert}
                    onDismiss={handleDismiss}
                    onViewProduct={handleViewProduct}
                    compact={compact}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
          
          {sortedAlerts.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <Link href="/inventory?filter=alerts">
                <Button variant="outline" className="w-full">
                  查看所有预警
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)

InventoryAlerts.displayName = "InventoryAlerts"

export { InventoryAlerts, InventoryAlertItem }

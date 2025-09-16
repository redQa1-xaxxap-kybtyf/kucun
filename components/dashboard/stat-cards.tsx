// 仪表盘统计卡片组件
// 展示关键业务指标的统计卡片

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  RotateCcw,
  ArrowRight
} from 'lucide-react'
import type { BusinessOverview, StatCard } from '@/lib/types/dashboard'
import { dashboardUtils } from '@/lib/api/dashboard'

// 图标映射
const ICON_MAP = {
  'dollar-sign': DollarSign,
  'shopping-cart': ShoppingCart,
  'package': Package,
  'users': Users,
  'alert-triangle': AlertTriangle,
  'rotate-ccw': RotateCcw,
} as const

// 颜色映射
const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    icon: 'text-blue-500',
    border: 'border-blue-200',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-600',
    icon: 'text-green-500',
    border: 'border-green-200',
  },
  yellow: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    icon: 'text-yellow-500',
    border: 'border-yellow-200',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-600',
    icon: 'text-red-500',
    border: 'border-red-200',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    icon: 'text-purple-500',
    border: 'border-purple-200',
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-600',
    icon: 'text-gray-500',
    border: 'border-gray-200',
  },
} as const

export interface StatCardProps {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'increase' | 'decrease' | 'neutral'
    period: string
  }
  icon: keyof typeof ICON_MAP
  color: keyof typeof COLOR_MAP
  href?: string
  loading?: boolean
  className?: string
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, change, icon, color, href, loading = false, className, ...props }, ref) => {
    const IconComponent = ICON_MAP[icon]
    const colorClasses = COLOR_MAP[color]
    
    if (loading) {
      return (
        <Card className={cn("", className)} ref={ref} {...props}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-12 w-12 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      )
    }

    const CardWrapper = href ? Link : 'div'
    const cardProps = href ? { href } : {}

    return (
      <CardWrapper {...cardProps}>
        <Card 
          className={cn(
            "transition-all duration-200",
            href && "cursor-pointer hover:shadow-md hover:scale-[1.02]",
            className
          )} 
          ref={ref} 
          {...props}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {title}
                </p>
                <div className="flex items-baseline space-x-2">
                  <p className="text-2xl font-bold">
                    {typeof value === 'number' ? dashboardUtils.formatNumber(value) : value}
                  </p>
                  {change && (
                    <div className="flex items-center space-x-1">
                      {change.type === 'increase' && (
                        <TrendingUp className="h-3 w-3 text-green-500" />
                      )}
                      {change.type === 'decrease' && (
                        <TrendingDown className="h-3 w-3 text-red-500" />
                      )}
                      {change.type === 'neutral' && (
                        <Minus className="h-3 w-3 text-gray-500" />
                      )}
                      <span className={cn(
                        "text-xs font-medium",
                        change.type === 'increase' && "text-green-600",
                        change.type === 'decrease' && "text-red-600",
                        change.type === 'neutral' && "text-gray-600"
                      )}>
                        {dashboardUtils.formatPercentage(change.value)}
                      </span>
                    </div>
                  )}
                </div>
                {change && (
                  <p className="text-xs text-muted-foreground">
                    较{change.period}
                  </p>
                )}
              </div>
              
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-lg",
                colorClasses.bg,
                colorClasses.border,
                "border"
              )}>
                <IconComponent className={cn("h-6 w-6", colorClasses.icon)} />
              </div>
            </div>
            
            {href && (
              <div className="mt-4 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
                <span>查看详情</span>
                <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            )}
          </CardContent>
        </Card>
      </CardWrapper>
    )
  }
)

StatCard.displayName = "StatCard"

// 统计卡片网格组件
export interface StatCardsGridProps {
  overview: BusinessOverview
  loading?: boolean
  className?: string
}

const StatCardsGrid = React.forwardRef<HTMLDivElement, StatCardsGridProps>(
  ({ overview, loading = false, className, ...props }, ref) => {
    // 构建统计卡片数据
    const statCards: StatCardProps[] = React.useMemo(() => [
      {
        title: '总收入',
        value: dashboardUtils.formatCurrency(overview?.sales?.totalRevenue || 0),
        change: {
          value: overview?.sales?.revenueGrowth || 0,
          type: (overview?.sales?.revenueGrowth || 0) >= 0 ? 'increase' : 'decrease',
          period: '上月'
        },
        icon: 'dollar-sign',
        color: 'green',
        href: '/sales-orders',
        loading
      },
      {
        title: '订单数量',
        value: overview?.sales?.totalOrders || 0,
        change: {
          value: overview?.sales?.ordersGrowth || 0,
          type: (overview?.sales?.ordersGrowth || 0) >= 0 ? 'increase' : 'decrease',
          period: '上月'
        },
        icon: 'shopping-cart',
        color: 'blue',
        href: '/sales-orders',
        loading
      },
      {
        title: '库存产品',
        value: overview?.inventory?.totalProducts || 0,
        change: {
          value: overview?.inventory?.stockHealth || 0,
          type: (overview?.inventory?.stockHealth || 0) >= 80 ? 'increase' : 
                (overview?.inventory?.stockHealth || 0) >= 60 ? 'neutral' : 'decrease',
          period: '健康度'
        },
        icon: 'package',
        color: 'purple',
        href: '/inventory',
        loading
      },
      {
        title: '活跃客户',
        value: overview?.customers?.activeCustomers || 0,
        change: {
          value: overview?.customers?.customerGrowth || 0,
          type: (overview?.customers?.customerGrowth || 0) >= 0 ? 'increase' : 'decrease',
          period: '上月'
        },
        icon: 'users',
        color: 'blue',
        href: '/customers',
        loading
      },
      {
        title: '库存预警',
        value: (overview?.inventory?.lowStockCount || 0) + (overview?.inventory?.outOfStockCount || 0),
        change: overview?.inventory?.lowStockCount ? {
          value: overview.inventory.lowStockCount,
          type: 'neutral' as const,
          period: '库存不足'
        } : undefined,
        icon: 'alert-triangle',
        color: (overview?.inventory?.lowStockCount || 0) > 0 ? 'red' : 'green',
        href: '/inventory?filter=alerts',
        loading
      },
      {
        title: '退货处理',
        value: overview?.returns?.pendingReturns || 0,
        change: {
          value: overview?.returns?.returnRate || 0,
          type: 'neutral' as const,
          period: '退货率'
        },
        icon: 'rotate-ccw',
        color: (overview?.returns?.pendingReturns || 0) > 0 ? 'yellow' : 'gray',
        href: '/return-orders',
        loading
      },
    ], [overview, loading])

    return (
      <div 
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4",
          className
        )} 
        ref={ref} 
        {...props}
      >
        {statCards.map((card, index) => (
          <StatCard key={index} {...card} />
        ))}
      </div>
    )
  }
)

StatCardsGrid.displayName = "StatCardsGrid"

// 单个指标卡片（用于移动端优化）
export interface MobileStatCardProps extends StatCardProps {
  compact?: boolean
}

const MobileStatCard = React.forwardRef<HTMLDivElement, MobileStatCardProps>(
  ({ compact = false, ...props }, ref) => {
    if (compact) {
      const IconComponent = ICON_MAP[props.icon]
      const colorClasses = COLOR_MAP[props.color]
      
      return (
        <div 
          className="flex items-center justify-between p-3 bg-card rounded-lg border"
          ref={ref}
        >
          <div className="flex items-center space-x-3">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded",
              colorClasses.bg
            )}>
              <IconComponent className={cn("h-4 w-4", colorClasses.icon)} />
            </div>
            <div>
              <p className="text-sm font-medium">{props.title}</p>
              <p className="text-xs text-muted-foreground">
                {typeof props.value === 'number' ? dashboardUtils.formatNumber(props.value) : props.value}
              </p>
            </div>
          </div>
          
          {props.change && (
            <Badge variant="outline" className="text-xs">
              {dashboardUtils.formatPercentage(props.change.value)}
            </Badge>
          )}
        </div>
      )
    }
    
    return <StatCard {...props} ref={ref} />
  }
)

MobileStatCard.displayName = "MobileStatCard"

export { StatCard, StatCardsGrid, MobileStatCard }

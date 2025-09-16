// 仪表盘快速操作组件
// 提供常用操作的快速入口

'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { 
  Plus, 
  ShoppingCart, 
  Package, 
  Users, 
  RotateCcw,
  Upload,
  Download,
  BarChart3,
  Settings,
  Search,
  FileText,
  Truck,
  AlertTriangle
} from 'lucide-react'

import type { QuickAction } from '@/lib/types/dashboard'

// 图标映射
const ICON_MAP = {
  'plus': Plus,
  'shopping-cart': ShoppingCart,
  'package': Package,
  'users': Users,
  'rotate-ccw': RotateCcw,
  'upload': Upload,
  'download': Download,
  'bar-chart-3': BarChart3,
  'settings': Settings,
  'search': Search,
  'file-text': FileText,
  'truck': Truck,
  'alert-triangle': AlertTriangle,
} as const

// 颜色配置
const COLOR_CONFIG = {
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    text: 'text-blue-600',
    icon: 'text-blue-500',
    border: 'border-blue-200 hover:border-blue-300',
  },
  green: {
    bg: 'bg-green-50 hover:bg-green-100',
    text: 'text-green-600',
    icon: 'text-green-500',
    border: 'border-green-200 hover:border-green-300',
  },
  yellow: {
    bg: 'bg-yellow-50 hover:bg-yellow-100',
    text: 'text-yellow-600',
    icon: 'text-yellow-500',
    border: 'border-yellow-200 hover:border-yellow-300',
  },
  red: {
    bg: 'bg-red-50 hover:bg-red-100',
    text: 'text-red-600',
    icon: 'text-red-500',
    border: 'border-red-200 hover:border-red-300',
  },
  purple: {
    bg: 'bg-purple-50 hover:bg-purple-100',
    text: 'text-purple-600',
    icon: 'text-purple-500',
    border: 'border-purple-200 hover:border-purple-300',
  },
  gray: {
    bg: 'bg-gray-50 hover:bg-gray-100',
    text: 'text-gray-600',
    icon: 'text-gray-500',
    border: 'border-gray-200 hover:border-gray-300',
  },
  orange: {
    bg: 'bg-orange-50 hover:bg-orange-100',
    text: 'text-orange-600',
    icon: 'text-orange-500',
    border: 'border-orange-200 hover:border-orange-300',
  },
  indigo: {
    bg: 'bg-indigo-50 hover:bg-indigo-100',
    text: 'text-indigo-600',
    icon: 'text-indigo-500',
    border: 'border-indigo-200 hover:border-indigo-300',
  },
} as const

// 默认颜色配置（防御性编程）
const DEFAULT_COLOR_CONFIG = {
  bg: 'bg-gray-50 hover:bg-gray-100',
  text: 'text-gray-600',
  icon: 'text-gray-500',
  border: 'border-gray-200 hover:border-gray-300',
}

// 类型安全的颜色配置获取函数
const getColorConfig = (color: string) => {
  return COLOR_CONFIG[color as keyof typeof COLOR_CONFIG] || DEFAULT_COLOR_CONFIG
}

export interface QuickActionItemProps {
  action: QuickAction
  onClick?: (action: QuickAction) => void
  compact?: boolean
  className?: string
}

const QuickActionItem = React.forwardRef<HTMLDivElement, QuickActionItemProps>(
  ({ action, onClick, compact = false, className, ...props }, ref) => {
    const IconComponent = ICON_MAP[action.icon as keyof typeof ICON_MAP] || Package
    const colorConfig = getColorConfig(action.color)
    
    const handleClick = () => {
      if (onClick) {
        onClick(action)
      }
    }

    if (compact) {
      return (
        <Link href={action.href}>
          <div 
            className={cn(
              "flex items-center space-x-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer",
              colorConfig.bg,
              colorConfig.border,
              className
            )}
            ref={ref}
            onClick={handleClick}
            {...props}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md",
              colorConfig.bg.replace('hover:', '').replace('50', '100')
            )}>
              <IconComponent className={cn("h-4 w-4", colorConfig.icon)} />
            </div>
            
            <div className="min-w-0 flex-1">
              <p className={cn("font-medium text-sm", colorConfig.text)}>
                {action.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {action.description}
              </p>
            </div>
            
            {action.badge && (
              <Badge 
                variant={action.badge.variant} 
                className="text-xs flex-shrink-0"
              >
                {action.badge.text}
              </Badge>
            )}
          </div>
        </Link>
      )
    }

    return (
      <Link href={action.href}>
        <Card 
          className={cn(
            "transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02]",
            colorConfig.border,
            className
          )}
          ref={ref}
          onClick={handleClick}
          {...props}
        >
          <CardContent className={cn("p-6", colorConfig.bg)}>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    colorConfig.bg.replace('hover:', '').replace('50', '100'),
                    colorConfig.border.replace('hover:', '')
                  )}>
                    <IconComponent className={cn("h-5 w-5", colorConfig.icon)} />
                  </div>
                  {action.badge && (
                    <Badge variant={action.badge.variant} className="text-xs">
                      {action.badge.text}
                    </Badge>
                  )}
                </div>
                
                <div>
                  <h3 className={cn("font-semibold text-sm", colorConfig.text)}>
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {action.description}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }
)

QuickActionItem.displayName = "QuickActionItem"

export interface QuickActionsProps {
  actions: QuickAction[]
  loading?: boolean
  onActionClick?: (action: QuickAction) => void
  showHeader?: boolean
  compact?: boolean
  columns?: number
  className?: string
}

const QuickActions = React.forwardRef<HTMLDivElement, QuickActionsProps>(
  ({ 
    actions, 
    loading = false, 
    onActionClick, 
    showHeader = true,
    compact = false,
    columns = 3,
    className,
    ...props 
  }, ref) => {
    // 默认快速操作（当没有数据时显示）
    const defaultActions: QuickAction[] = React.useMemo(() => [
      {
        id: 'create-sales-order',
        title: '创建销售订单',
        description: '新建销售订单',
        icon: 'shopping-cart',
        href: '/sales-orders/create',
        color: 'blue'
      },
      {
        id: 'add-product',
        title: '添加产品',
        description: '新增产品信息',
        icon: 'package',
        href: '/products/create',
        color: 'green'
      },
      {
        id: 'add-customer',
        title: '添加客户',
        description: '新增客户信息',
        icon: 'users',
        href: '/customers/create',
        color: 'purple'
      },
      {
        id: 'inventory-inbound',
        title: '库存入库',
        description: '商品入库操作',
        icon: 'upload',
        href: '/inventory/inbound',
        color: 'yellow'
      },
      {
        id: 'inventory-outbound',
        title: '库存出库',
        description: '商品出库操作',
        icon: 'download',
        href: '/inventory/outbound',
        color: 'red'
      },
      {
        id: 'create-purchase-order',
        title: '创建采购订单',
        description: '新建采购订单',
        icon: 'truck',
        href: '/purchase-orders/create',
        color: 'green'
      },
      {
        id: 'process-returns',
        title: '处理退货',
        description: '退货订单处理',
        icon: 'rotate-ccw',
        href: '/return-orders',
        color: 'yellow',
        badge: {
          text: '待处理',
          variant: 'secondary'
        }
      },
      {
        id: 'inventory-alerts',
        title: '库存预警',
        description: '查看库存预警',
        icon: 'alert-triangle',
        href: '/inventory?filter=alerts',
        color: 'red',
        badge: {
          text: '预警',
          variant: 'destructive'
        }
      },
      {
        id: 'reports',
        title: '业务报表',
        description: '查看业务报表',
        icon: 'bar-chart-3',
        href: '/reports',
        color: 'blue'
      }
    ], [])

    const displayActions = actions.length > 0 ? actions : defaultActions

    if (loading) {
      return (
        <Card className={className} ref={ref} {...props}>
          {showHeader && (
            <CardHeader>
              <Skeleton className="h-5 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
          )}
          <CardContent>
            <div className={cn(
              "grid gap-4",
              compact ? "grid-cols-1" : `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
            )}>
              {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
                <div key={i} className="p-4 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
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
            <CardTitle className="flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>快速操作</span>
            </CardTitle>
            <CardDescription>
              常用功能快速入口
            </CardDescription>
          </CardHeader>
        )}
        
        <CardContent>
          {displayActions.length === 0 ? (
            <div className="text-center py-8">
              <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无快速操作</p>
            </div>
          ) : (
            <div className={cn(
              "grid gap-4",
              compact 
                ? "grid-cols-1" 
                : `grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns}`
            )}>
              {displayActions.map((action) => (
                <QuickActionItem
                  key={action.id}
                  action={action}
                  onClick={onActionClick}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    )
  }
)

QuickActions.displayName = "QuickActions"

// 快速操作按钮组（用于移动端）
export interface QuickActionButtonsProps {
  actions: QuickAction[]
  maxVisible?: number
  className?: string
}

const QuickActionButtons = React.forwardRef<HTMLDivElement, QuickActionButtonsProps>(
  ({ actions, maxVisible = 4, className, ...props }, ref) => {
    const visibleActions = actions.slice(0, maxVisible)
    
    return (
      <div 
        className={cn("flex flex-wrap gap-2", className)} 
        ref={ref} 
        {...props}
      >
        {visibleActions.map((action) => {
          const IconComponent = ICON_MAP[action.icon as keyof typeof ICON_MAP] || Package
          const colorConfig = getColorConfig(action.color)
          
          return (
            <Link key={action.id} href={action.href}>
              <Button 
                variant="outline" 
                size="sm"
                className={cn(
                  "flex items-center space-x-2",
                  colorConfig.border,
                  colorConfig.bg,
                  colorConfig.text
                )}
              >
                <IconComponent className="h-4 w-4" />
                <span>{action.title}</span>
                {action.badge && (
                  <Badge variant={action.badge.variant} className="text-xs ml-1">
                    {action.badge.text}
                  </Badge>
                )}
              </Button>
            </Link>
          )
        })}
        
        {actions.length > maxVisible && (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            更多 ({actions.length - maxVisible})
          </Button>
        )}
      </div>
    )
  }
)

QuickActionButtons.displayName = "QuickActionButtons"

export { QuickActions, QuickActionItem, QuickActionButtons }

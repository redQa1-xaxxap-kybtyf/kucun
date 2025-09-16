// 仪表盘主页面
// 基于T11 UI组件库的完整仪表盘实现

'use client'

import * as React from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  RefreshCw,
  Calendar,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckSquare,
  Zap,
  Settings
} from 'lucide-react'

// 仪表盘组件
import { StatCardsGrid } from '@/components/dashboard/stat-cards'
import { InventoryAlerts } from '@/components/dashboard/inventory-alerts'
import { TodoList } from '@/components/dashboard/todo-list'
import { QuickActions, QuickActionButtons } from '@/components/dashboard/quick-actions'

// T11 UI组件库
import { MobileDataTable } from '@/components/ui/mobile-data-table'
import { InventoryHealth } from '@/components/ui/inventory-status-indicator'

// API和类型
import {
  useDashboardData,
  useBusinessOverview,
  useInventoryAlerts,
  useTodoItems,
  useQuickActions,
  dashboardUtils
} from '@/lib/api/dashboard'
import type { TimeRange, DashboardFilters } from '@/lib/types/dashboard'

// 时间范围选项
const TIME_RANGE_OPTIONS = [
  { value: '1d', label: '今天' },
  { value: '7d', label: '最近7天' },
  { value: '30d', label: '最近30天' },
  { value: '90d', label: '最近90天' },
  { value: '1y', label: '最近1年' },
  { value: 'all', label: '全部' },
] as const

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 状态管理
  const [filters, setFilters] = React.useState<DashboardFilters>({
    timeRange: '30d'
  })
  const [activeTab, setActiveTab] = React.useState('overview')
  const [refreshKey, setRefreshKey] = React.useState(0)

  // 认证检查
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 数据获取
  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard
  } = useDashboardData(filters)

  const {
    data: businessOverview,
    isLoading: isOverviewLoading,
    refetch: refetchOverview
  } = useBusinessOverview(filters.timeRange)

  const {
    data: inventoryAlerts,
    isLoading: isAlertsLoading,
    refetch: refetchAlerts
  } = useInventoryAlerts()

  const {
    data: todoItems,
    isLoading: isTodosLoading,
    refetch: refetchTodos
  } = useTodoItems()

  const {
    data: quickActions,
    isLoading: isActionsLoading
  } = useQuickActions()

  // 处理刷新
  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
    refetchDashboard()
    refetchOverview()
    refetchAlerts()
    refetchTodos()
  }

  // 处理时间范围变化
  const handleTimeRangeChange = (timeRange: TimeRange) => {
    setFilters(prev => ({ ...prev, timeRange }))
  }

  // 处理待办事项查看
  const handleViewTodo = (todo: any) => {
    // 根据待办事项类型跳转到相应页面
    const routes = {
      sales_order: '/sales-orders',
      purchase_order: '/purchase-orders',
      return_order: '/return-orders',
      inventory_alert: '/inventory',
      customer_follow_up: '/customers'
    }

    const route = routes[todo.type as keyof typeof routes]
    if (route) {
      router.push(todo.relatedId ? `${route}/${todo.relatedId}` : route)
    }
  }

  // 处理产品查看
  const handleViewProduct = (productId: string) => {
    router.push(`/products/${productId}`)
  }

  if (status === 'loading' || !session) {
    return <DashboardPageSkeleton />
  }

  if (dashboardError) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {dashboardError instanceof Error ? dashboardError.message : '获取仪表盘数据失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={handleRefresh}>重试</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和控制 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">仪表盘</h1>
          <p className="text-muted-foreground">
            欢迎回来，{session.user?.name || '用户'}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* 时间范围选择 */}
          <Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 刷新按钮 */}
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新
          </Button>
        </div>
      </div>

      {/* 移动端快速操作按钮 */}
      <div className="md:hidden">
        <QuickActionButtons
          actions={quickActions || []}
          maxVisible={3}
        />
      </div>

      {/* 主要内容 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">概览</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span className="hidden sm:inline">预警</span>
            {inventoryAlerts && inventoryAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {inventoryAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="todos" className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4" />
            <span className="hidden sm:inline">待办</span>
            {todoItems && todoItems.filter(t => t.status !== 'completed').length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {todoItems.filter(t => t.status !== 'completed').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="actions" className="flex items-center space-x-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">操作</span>
          </TabsTrigger>
        </TabsList>

        {/* 概览标签页 */}
        <TabsContent value="overview" className="space-y-6">
          {/* 统计卡片 */}
          <StatCardsGrid
            overview={businessOverview}
            loading={isOverviewLoading}
          />

          {/* 主要内容网格 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 库存预警 */}
            <div className="lg:col-span-1">
              <InventoryAlerts
                alerts={inventoryAlerts || []}
                loading={isAlertsLoading}
                onRefresh={refetchAlerts}
                onViewProduct={handleViewProduct}
                maxHeight="400px"
                compact
              />
            </div>

            {/* 待办事项 */}
            <div className="lg:col-span-1">
              <TodoList
                todos={todoItems || []}
                loading={isTodosLoading}
                onRefresh={refetchTodos}
                onViewTodo={handleViewTodo}
                maxHeight="400px"
                compact
              />
            </div>

            {/* 库存健康度 */}
            <div className="lg:col-span-1">
              {businessOverview && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5" />
                      <span>库存健康度</span>
                    </CardTitle>
                    <CardDescription>
                      库存状态总览
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <InventoryHealth
                      items={[
                        {
                          id: '1',
                          name: '总库存',
                          currentStock: businessOverview.inventory.totalStock,
                          safetyStock: Math.floor(businessOverview.inventory.totalStock * 0.2),
                          status: businessOverview.inventory.stockHealth >= 80 ? 'in_stock' :
                                 businessOverview.inventory.stockHealth >= 60 ? 'low_stock' : 'out_of_stock'
                        }
                      ]}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* 预警标签页 */}
        <TabsContent value="alerts" className="space-y-6">
          <InventoryAlerts
            alerts={inventoryAlerts || []}
            loading={isAlertsLoading}
            onRefresh={refetchAlerts}
            onViewProduct={handleViewProduct}
            maxHeight="600px"
          />
        </TabsContent>

        {/* 待办标签页 */}
        <TabsContent value="todos" className="space-y-6">
          <TodoList
            todos={todoItems || []}
            loading={isTodosLoading}
            onRefresh={refetchTodos}
            onViewTodo={handleViewTodo}
            maxHeight="600px"
            showCompleted
          />
        </TabsContent>

        {/* 快速操作标签页 */}
        <TabsContent value="actions" className="space-y-6">
          <QuickActions
            actions={quickActions || []}
            loading={isActionsLoading}
            columns={3}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// 加载骨架屏
function DashboardPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 标题骨架屏 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      {/* 标签页骨架屏 */}
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />

        {/* 统计卡片骨架屏 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
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
          ))}
        </div>

        {/* 主要内容骨架屏 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

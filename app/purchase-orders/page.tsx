'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Icons
import { 
  Plus, 
  Search, 
  Filter, 
  ShoppingCart, 
  AlertCircle,
  Calendar,
  RefreshCw,
  Download,
  BarChart3,
  MoreHorizontal,
  Eye,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  Package
} from 'lucide-react'

// API and Types
import { getPurchaseOrders, getPurchaseOrderStats, purchaseOrderQueryKeys } from '@/lib/api/purchase-orders'
import { PurchaseOrder, PurchaseOrderQueryParams } from '@/lib/types/purchase-order'
import { 
  PURCHASE_ORDER_STATUS_LABELS,
  PURCHASE_ORDER_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE,
  getPurchaseOrderStatus,
  formatPurchaseOrderAmount,
  formatDeliveryDate
} from '@/lib/types/purchase-order'
import { 
  purchaseOrderSearchSchema, 
  PurchaseOrderSearchFormData, 
  purchaseOrderSearchDefaults 
} from '@/lib/validations/purchase-order'

export default function PurchaseOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // 状态管理
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // 搜索表单
  const searchForm = useForm<PurchaseOrderSearchFormData>({
    resolver: zodResolver(purchaseOrderSearchSchema),
    defaultValues: purchaseOrderSearchDefaults,
  })

  const searchParams = searchForm.watch()

  // 构建查询参数
  const queryParams: PurchaseOrderQueryParams = {
    page: currentPage,
    limit: DEFAULT_PAGE_SIZE,
    search: searchParams.search || undefined,
    status: searchParams.status || undefined,
    supplierId: searchParams.supplierId || undefined,
    userId: searchParams.userId || undefined,
    startDate: searchParams.startDate || undefined,
    endDate: searchParams.endDate || undefined,
    sortBy: searchParams.sortBy,
    sortOrder: searchParams.sortOrder,
  }

  // 获取采购订单列表
  const {
    data: purchaseOrdersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: purchaseOrderQueryKeys.list(queryParams),
    queryFn: () => getPurchaseOrders(queryParams),
    enabled: !!session?.user?.id,
  })

  // 获取采购订单统计
  const { data: statsData } = useQuery({
    queryKey: purchaseOrderQueryKeys.stats(),
    queryFn: () => getPurchaseOrderStats(),
    enabled: !!session?.user?.id,
  })

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 重置搜索
  const resetSearch = () => {
    searchForm.reset(purchaseOrderSearchDefaults)
    setCurrentPage(1)
  }

  // 页面变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 选择项目
  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId])
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId))
    }
  }

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = purchaseOrdersData?.data?.purchaseOrders.map(item => item.id) || []
      setSelectedItems(allIds)
    } else {
      setSelectedItems([])
    }
  }

  if (status === 'loading' || isLoading) {
    return <PurchaseOrdersPageSkeleton />
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : '获取采购订单列表失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  const purchaseOrders = purchaseOrdersData?.data?.purchaseOrders || []
  const pagination = purchaseOrdersData?.data?.pagination
  const stats = statsData?.data

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">采购管理</h1>
          <p className="text-muted-foreground">管理采购订单，跟踪采购进度</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push('/purchase-orders/records')}>
            <Package className="h-4 w-4 mr-2" />
            采购记录
          </Button>
          <Button onClick={() => router.push('/purchase-orders/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建采购订单
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总订单数</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总采购金额</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatPurchaseOrderAmount(stats.totalAmount)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待确认</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.draftCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">逾期订单</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-base">
            <Filter className="h-4 w-4 mr-2" />
            搜索筛选
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...searchForm}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 搜索关键词 */}
              <FormField
                control={searchForm.control}
                name="search"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>搜索关键词</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="订单号、供应商..."
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 订单状态 */}
              <FormField
                control={searchForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>订单状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="全部状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">全部状态</SelectItem>
                        {Object.entries(PURCHASE_ORDER_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 开始日期 */}
              <FormField
                control={searchForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>开始日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 结束日期 */}
              <FormField
                control={searchForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>结束日期</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 排序方式 */}
              <FormField
                control={searchForm.control}
                name="sortBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序方式</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PURCHASE_ORDER_SORT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 排序顺序 */}
              <FormField
                control={searchForm.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序顺序</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="desc">降序</SelectItem>
                        <SelectItem value="asc">升序</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center space-x-2 mt-4">
              <Button type="button" variant="outline" onClick={resetSearch}>
                重置
              </Button>
              <Button type="button" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
              {selectedItems.length > 0 && (
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  导出选中 ({selectedItems.length})
                </Button>
              )}
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* 采购订单列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                采购订单列表
              </CardTitle>
              <CardDescription>
                {pagination && `共 ${pagination.total} 个采购订单，第 ${pagination.page} / ${pagination.totalPages} 页`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {purchaseOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无采购订单</h3>
              <p className="text-muted-foreground mb-4">
                还没有任何采购订单记录
              </p>
              <Button onClick={() => router.push('/purchase-orders/create')}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个采购订单
              </Button>
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedItems.length === purchaseOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>订单号</TableHead>
                      <TableHead>供应商</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>订单金额</TableHead>
                      <TableHead>预期交货</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrders.map((order) => {
                      const status = getPurchaseOrderStatus(order)
                      
                      return (
                        <TableRow key={order.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(order.id)}
                              onCheckedChange={(checked) => handleSelectItem(order.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-mono font-medium">
                              {order.orderNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {order.supplier?.name || '未知供应商'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.supplier?.contactPerson}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {formatPurchaseOrderAmount(order.totalAmount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {order.expectedDeliveryDate ? (
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatDeliveryDate(order.expectedDeliveryDate)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">未设置</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/purchase-orders/${order.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  编辑订单
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Copy className="mr-2 h-4 w-4" />
                                  复制订单
                                </DropdownMenuItem>
                                {order.status === 'draft' && (
                                  <DropdownMenuItem>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    确认订单
                                  </DropdownMenuItem>
                                )}
                                {(order.status === 'draft' || order.status === 'confirmed') && (
                                  <DropdownMenuItem className="text-red-600">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    删除订单
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {purchaseOrders.map((order) => {
                  const status = getPurchaseOrderStatus(order)
                  
                  return (
                    <Card key={order.id} className="border-muted">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedItems.includes(order.id)}
                              onCheckedChange={(checked) => handleSelectItem(order.id, checked as boolean)}
                            />
                            <div className="font-mono font-medium text-sm">
                              {order.orderNumber}
                            </div>
                          </div>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">供应商:</span>
                            <span>{order.supplier?.name || '未知供应商'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">订单金额:</span>
                            <span className="font-medium">
                              {formatPurchaseOrderAmount(order.totalAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">预期交货:</span>
                            <span>
                              {order.expectedDeliveryDate ? 
                                formatDeliveryDate(order.expectedDeliveryDate) : '未设置'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">创建时间:</span>
                            <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end space-x-2 mt-3 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/purchase-orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/purchase-orders/${order.id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            编辑
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* 分页 */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    第 {currentPage} / {pagination.totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// 加载骨架屏
function PurchaseOrdersPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

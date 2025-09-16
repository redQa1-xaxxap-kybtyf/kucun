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
  RotateCcw, 
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
  Package,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

// API and Types
import { getReturnOrders, getReturnOrderStats, returnOrderQueryKeys } from '@/lib/api/return-orders'
import { ReturnOrder, ReturnOrderQueryParams } from '@/lib/types/return-order'
import { 
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  RETURN_ORDER_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE,
  getReturnOrderStatus,
  formatReturnAmount,
  formatReturnDate
} from '@/lib/types/return-order'
import { 
  returnOrderSearchSchema, 
  ReturnOrderSearchFormData, 
  returnOrderSearchDefaults 
} from '@/lib/validations/return-order'

export default function ReturnOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // 状态管理
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // 搜索表单
  const searchForm = useForm<ReturnOrderSearchFormData>({
    resolver: zodResolver(returnOrderSearchSchema),
    defaultValues: returnOrderSearchDefaults,
  })

  const searchParams = searchForm.watch()

  // 构建查询参数
  const queryParams: ReturnOrderQueryParams = {
    page: currentPage,
    limit: DEFAULT_PAGE_SIZE,
    search: searchParams.search || undefined,
    status: searchParams.status || undefined,
    type: searchParams.type || undefined,
    processType: searchParams.processType || undefined,
    customerId: searchParams.customerId || undefined,
    salesOrderId: searchParams.salesOrderId || undefined,
    userId: searchParams.userId || undefined,
    startDate: searchParams.startDate || undefined,
    endDate: searchParams.endDate || undefined,
    sortBy: searchParams.sortBy,
    sortOrder: searchParams.sortOrder,
  }

  // 获取退货订单列表
  const {
    data: returnOrdersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: returnOrderQueryKeys.list(queryParams),
    queryFn: () => getReturnOrders(queryParams),
    enabled: !!session?.user?.id,
  })

  // 获取退货统计
  const { data: statsData } = useQuery({
    queryKey: returnOrderQueryKeys.stats(),
    queryFn: () => getReturnOrderStats(),
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
    searchForm.reset(returnOrderSearchDefaults)
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
      const allIds = returnOrdersData?.data?.returnOrders.map(item => item.id) || []
      setSelectedItems(allIds)
    } else {
      setSelectedItems([])
    }
  }

  if (status === 'loading' || isLoading) {
    return <ReturnOrdersPageSkeleton />
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
            {error instanceof Error ? error.message : '获取退货订单列表失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  const returnOrders = returnOrdersData?.data?.returnOrders || []
  const pagination = returnOrdersData?.data?.pagination
  const stats = statsData?.data

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">退货管理</h1>
          <p className="text-muted-foreground">管理退货订单，处理退货申请和审核</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push('/return-orders/records')}>
            <Package className="h-4 w-4 mr-2" />
            退货记录
          </Button>
          <Button onClick={() => router.push('/return-orders/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建退货订单
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总退货数</CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalReturns}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3 mr-1" />
                本月 {stats.monthlyReturns} 单
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总退款金额</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatReturnAmount(stats.totalRefundAmount)}</div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingDown className="h-3 w-3 mr-1" />
                本月 {formatReturnAmount(stats.monthlyRefundAmount)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待审核</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingCount}</div>
              <div className="text-xs text-muted-foreground">需要处理</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已完成</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.completedCount}</div>
              <div className="text-xs text-muted-foreground">处理完成</div>
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
                          placeholder="退货单号、客户..."
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 退货状态 */}
              <FormField
                control={searchForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退货状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="全部状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">全部状态</SelectItem>
                        {Object.entries(RETURN_ORDER_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 退货类型 */}
              <FormField
                control={searchForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>退货类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="全部类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">全部类型</SelectItem>
                        {Object.entries(RETURN_ORDER_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 处理方式 */}
              <FormField
                control={searchForm.control}
                name="processType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>处理方式</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="全部方式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">全部方式</SelectItem>
                        {Object.entries(RETURN_PROCESS_TYPE_LABELS).map(([value, label]) => (
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
                        {RETURN_ORDER_SORT_OPTIONS.map(option => (
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

      {/* 退货订单列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <RotateCcw className="h-5 w-5 mr-2" />
                退货订单列表
              </CardTitle>
              <CardDescription>
                {pagination && `共 ${pagination.total} 个退货订单，第 ${pagination.page} / ${pagination.totalPages} 页`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {returnOrders.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无退货订单</h3>
              <p className="text-muted-foreground mb-4">
                还没有任何退货订单记录
              </p>
              <Button onClick={() => router.push('/return-orders/create')}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个退货订单
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
                          checked={selectedItems.length === returnOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>退货单号</TableHead>
                      <TableHead>关联销售单</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>退货类型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>退货金额</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {returnOrders.map((order) => {
                      const status = getReturnOrderStatus(order)
                      
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
                              {order.returnNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">
                              {order.salesOrder?.orderNumber || '未知订单'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {order.customer?.name || '未知客户'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {order.customer?.phone}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {RETURN_ORDER_TYPE_LABELS[order.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {formatReturnAmount(order.totalAmount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {formatReturnDate(order.createdAt)}
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
                                <DropdownMenuItem onClick={() => router.push(`/return-orders/${order.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  查看详情
                                </DropdownMenuItem>
                                {order.status === 'draft' && (
                                  <DropdownMenuItem onClick={() => router.push(`/return-orders/${order.id}/edit`)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    编辑订单
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem>
                                  <Copy className="mr-2 h-4 w-4" />
                                  复制订单
                                </DropdownMenuItem>
                                {order.status === 'submitted' && (
                                  <DropdownMenuItem>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    审核订单
                                  </DropdownMenuItem>
                                )}
                                {order.status === 'draft' && (
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
                {returnOrders.map((order) => {
                  const status = getReturnOrderStatus(order)
                  
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
                              {order.returnNumber}
                            </div>
                          </div>
                          <Badge variant={status.variant} className="text-xs">
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">关联销售单:</span>
                            <span className="font-mono">{order.salesOrder?.orderNumber || '未知'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">客户:</span>
                            <span>{order.customer?.name || '未知客户'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">退货类型:</span>
                            <Badge variant="outline" className="text-xs">
                              {RETURN_ORDER_TYPE_LABELS[order.type]}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">退货金额:</span>
                            <span className="font-medium">
                              {formatReturnAmount(order.totalAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">创建时间:</span>
                            <span>{formatReturnDate(order.createdAt)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-end space-x-2 mt-3 pt-3 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/return-orders/${order.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          {order.status === 'draft' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/return-orders/${order.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              编辑
                            </Button>
                          )}
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
function ReturnOrdersPageSkeleton() {
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
              <Skeleton className="h-3 w-24 mt-2" />
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
            {Array.from({ length: 8 }).map((_, i) => (
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

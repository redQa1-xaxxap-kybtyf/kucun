'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// Icons
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  Copy, 
  FileText,
  ShoppingCart,
  AlertCircle,
  Calendar,
  User,
  Building2,
  RefreshCw
} from 'lucide-react'

// API and Types
import { getSalesOrders, deleteSalesOrder, copySalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders'
import { SalesOrder, SalesOrderQueryParams } from '@/lib/types/sales-order'
import { 
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_VARIANTS,
  SALES_ORDER_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE
} from '@/lib/types/sales-order'
import { 
  salesOrderSearchSchema, 
  SalesOrderSearchFormData, 
  salesOrderSearchDefaults 
} from '@/lib/validations/sales-order'

export default function SalesOrdersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // 状态管理
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // 搜索表单
  const searchForm = useForm<SalesOrderSearchFormData>({
    resolver: zodResolver(salesOrderSearchSchema),
    defaultValues: salesOrderSearchDefaults,
  })

  const searchParams = searchForm.watch()

  // 构建查询参数
  const queryParams: SalesOrderQueryParams = {
    page: currentPage,
    limit: DEFAULT_PAGE_SIZE,
    search: searchParams.search || undefined,
    status: (searchParams.status && searchParams.status !== 'all') ? searchParams.status : undefined,
    customerId: searchParams.customerId || undefined,
    userId: searchParams.userId || undefined,
    startDate: searchParams.startDate || undefined,
    endDate: searchParams.endDate || undefined,
    sortBy: searchParams.sortBy,
    sortOrder: searchParams.sortOrder,
  }

  // 获取销售订单列表
  const {
    data: salesOrdersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: salesOrderQueryKeys.list(queryParams),
    queryFn: () => getSalesOrders(queryParams),
    enabled: !!session?.user?.id,
  })

  // 删除销售订单 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() })
      setDeleteDialogOpen(false)
      setSelectedOrder(null)
    }
  })

  // 复制销售订单 Mutation
  const copyMutation = useMutation({
    mutationFn: copySalesOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() })
    }
  })

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 重置搜索
  const resetSearch = () => {
    searchForm.reset(salesOrderSearchDefaults)
    setCurrentPage(1)
  }

  // 处理删除
  const handleDelete = (order: SalesOrder) => {
    setSelectedOrder(order)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (selectedOrder) {
      deleteMutation.mutate(selectedOrder.id)
    }
  }

  // 处理复制
  const handleCopy = (order: SalesOrder) => {
    copyMutation.mutate(order.id)
  }

  // 页面变化
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  if (status === 'loading' || isLoading) {
    return <SalesOrdersPageSkeleton />
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
            {error instanceof Error ? error.message : '获取销售订单列表失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  const salesOrders = salesOrdersData?.data?.salesOrders || []
  const pagination = salesOrdersData?.data?.pagination

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">销售订单管理</h1>
          <p className="text-muted-foreground">管理销售订单，跟踪订单状态和明细</p>
        </div>
        <Button onClick={() => router.push('/sales-orders/create')}>
          <Plus className="h-4 w-4 mr-2" />
          新增订单
        </Button>
      </div>

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
                          placeholder="订单号、客户名称..."
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
                        <SelectItem value="all">全部状态</SelectItem>
                        {Object.entries(SALES_ORDER_STATUS_LABELS).map(([value, label]) => (
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
                        {SALES_ORDER_SORT_OPTIONS.map(option => (
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
            </div>
          </Form>
        </CardContent>
      </Card>

      {/* 销售订单列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <ShoppingCart className="h-5 w-5 mr-2" />
                销售订单列表
              </CardTitle>
              <CardDescription>
                {pagination && `共 ${pagination.total} 个订单，第 ${pagination.page} / ${pagination.totalPages} 页`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {salesOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无销售订单</h3>
              <p className="text-muted-foreground mb-4">
                还没有创建任何销售订单
              </p>
              <Button onClick={() => router.push('/sales-orders/create')}>
                <Plus className="h-4 w-4 mr-2" />
                创建第一个订单
              </Button>
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单号</TableHead>
                      <TableHead>客户</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>订单金额</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="font-mono font-medium">
                            {order.orderNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{order.customer?.name || '未知客户'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={SALES_ORDER_STATUS_VARIANTS[order.status]}>
                            {SALES_ORDER_STATUS_LABELS[order.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-green-600">
                            ¥{order.totalAmount.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => router.push(`/sales-orders/${order.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                查看详情
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/sales-orders/${order.id}/edit`)}>
                                <Edit className="h-4 w-4 mr-2" />
                                编辑订单
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopy(order)}>
                                <Copy className="h-4 w-4 mr-2" />
                                复制订单
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(order)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除订单
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {salesOrders.map((order) => (
                  <Card key={order.id} className="border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-mono font-medium text-sm">
                          {order.orderNumber}
                        </div>
                        <Badge variant={SALES_ORDER_STATUS_VARIANTS[order.status]} className="text-xs">
                          {SALES_ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">客户:</span>
                          <span>{order.customer?.name || '未知客户'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">金额:</span>
                          <span className="font-medium text-green-600">
                            ¥{order.totalAmount.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">创建时间:</span>
                          <span>{new Date(order.createdAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-2 mt-4">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/sales-orders/${order.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/sales-orders/${order.id}/edit`)}>
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopy(order)}>
                              <Copy className="h-4 w-4 mr-2" />
                              复制
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDelete(order)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
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

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除销售订单</DialogTitle>
            <DialogDescription>
              您确定要删除订单 "{selectedOrder?.orderNumber}" 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '确认删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 加载骨架屏
function SalesOrdersPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-24" />
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

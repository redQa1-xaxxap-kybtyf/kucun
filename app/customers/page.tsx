'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

// UI Components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Icons
import { Plus, Search, Filter, Edit, Trash2, Building2, AlertCircle, MoreHorizontal, Eye, Store, User } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// API and Types
import { getCustomers, deleteCustomer, customerQueryKeys } from '@/lib/api/customers'
import { Customer, CustomerQueryParams } from '@/lib/types/customer'
import { 
  CUSTOMER_TYPE_LABELS, 
  CUSTOMER_TYPE_VARIANTS,
  CUSTOMER_LEVEL_LABELS,
  CUSTOMER_LEVEL_VARIANTS,
  CUSTOMER_SORT_OPTIONS 
} from '@/lib/types/customer'
import { customerSearchSchema, CustomerSearchFormData, customerSearchDefaults } from '@/lib/validations/customer'

export default function CustomersPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, status } = useSession()
  const [queryParams, setQueryParams] = useState<CustomerQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })
  
  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    customer: Customer | null
  }>({
    open: false,
    customer: null
  })

  // 搜索表单
  const searchForm = useForm<CustomerSearchFormData>({
    resolver: zodResolver(customerSearchSchema),
    defaultValues: customerSearchDefaults,
  })

  // 获取客户列表
  const {
    data: customersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: customerQueryKeys.list(queryParams),
    queryFn: () => getCustomers(queryParams),
    enabled: !!session?.user?.id,
  })

  // 删除客户 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.lists() })
      setDeleteDialog({ open: false, customer: null })
    },
    onError: (error) => {
      console.error('删除客户失败:', error)
    }
  })

  // 搜索提交
  const onSearchSubmit = (data: CustomerSearchFormData) => {
    setQueryParams({
      page: 1,
      limit: 20,
      search: data.search || undefined,
      parentCustomerId: data.parentCustomerId || undefined,
      customerType: data.customerType || undefined,
      level: data.level || undefined,
      region: data.region || undefined,
      sortBy: data.sortBy,
      sortOrder: data.sortOrder,
    })
  }

  // 重置搜索
  const handleResetSearch = () => {
    searchForm.reset(customerSearchDefaults)
    setQueryParams({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  }

  // 处理删除客户
  const handleDeleteCustomer = (customer: Customer) => {
    setDeleteDialog({ open: true, customer })
  }

  // 确认删除
  const confirmDelete = async () => {
    if (deleteDialog.customer) {
      await deleteMutation.mutateAsync(deleteDialog.customer.id)
    }
  }

  // 分页处理
  const handlePageChange = (newPage: number) => {
    setQueryParams(prev => ({ ...prev, page: newPage }))
  }

  // 认证检查
  if (status === 'loading') {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  // 获取客户类型图标
  const getCustomerTypeIcon = (extendedInfo?: string) => {
    try {
      const info = extendedInfo ? JSON.parse(extendedInfo) : {}
      switch (info.customerType) {
        case 'company': return <Building2 className="h-4 w-4" />
        case 'store': return <Store className="h-4 w-4" />
        case 'individual': return <User className="h-4 w-4" />
        default: return <Building2 className="h-4 w-4" />
      }
    } catch {
      return <Building2 className="h-4 w-4" />
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">客户管理</h1>
          <p className="text-muted-foreground">
            管理客户信息、层级关系和业务资料
          </p>
        </div>
        <Button onClick={() => router.push('/customers/create')}>
          <Plus className="h-4 w-4 mr-2" />
          新增客户
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-5 w-5 mr-2" />
            搜索筛选
          </CardTitle>
          <CardDescription>
            根据客户名称、类型、等级等条件筛选客户
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...searchForm}>
            <form onSubmit={searchForm.handleSubmit(onSearchSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={searchForm.control}
                  name="search"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>搜索关键词</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="客户名称、电话..."
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="customerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="全部类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">全部类型</SelectItem>
                          {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客户等级</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="全部等级" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">全部等级</SelectItem>
                          {Object.entries(CUSTOMER_LEVEL_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>所在区域</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：华南地区"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={searchForm.control}
                  name="sortBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排序字段</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CUSTOMER_SORT_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>排序方向</FormLabel>
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

              <div className="flex gap-2">
                <Button type="submit">
                  <Search className="h-4 w-4 mr-2" />
                  搜索
                </Button>
                <Button type="button" variant="outline" onClick={handleResetSearch}>
                  重置
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* 客户列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              客户列表
            </span>
            {customersData?.data && (
              <span className="text-sm text-muted-foreground">
                共 {customersData.data.pagination.total} 条记录
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : '获取客户列表失败'}
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : customersData?.data?.customers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无客户数据</h3>
              <p className="text-muted-foreground mb-4">
                还没有添加任何客户，点击上方按钮创建第一个客户
              </p>
              <Button onClick={() => router.push('/customers/create')}>
                <Plus className="h-4 w-4 mr-2" />
                新增客户
              </Button>
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户信息</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead>类型/等级</TableHead>
                      <TableHead>统计信息</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customersData?.data?.customers.map((customer) => {
                      const extendedInfo = customer.extendedInfo 
                        ? JSON.parse(customer.extendedInfo) 
                        : {}

                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="text-muted-foreground">
                                {getCustomerTypeIcon(customer.extendedInfo)}
                              </div>
                              <div>
                                <div className="font-medium">{customer.name}</div>
                                {customer.parentCustomer && (
                                  <div className="text-sm text-muted-foreground">
                                    隶属于：{customer.parentCustomer.name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {customer.phone && (
                                <div className="text-sm">{customer.phone}</div>
                              )}
                              {customer.address && (
                                <div className="text-sm text-muted-foreground truncate max-w-48">
                                  {customer.address}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {extendedInfo.customerType && (
                                <Badge variant={CUSTOMER_TYPE_VARIANTS[extendedInfo.customerType]}>
                                  {CUSTOMER_TYPE_LABELS[extendedInfo.customerType]}
                                </Badge>
                              )}
                              {extendedInfo.level && (
                                <Badge variant={CUSTOMER_LEVEL_VARIANTS[extendedInfo.level]}>
                                  {CUSTOMER_LEVEL_LABELS[extendedInfo.level]}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm space-y-1">
                              {customer.totalOrders !== undefined && (
                                <div>订单: {customer.totalOrders}</div>
                              )}
                              {customer.totalAmount !== undefined && (
                                <div>金额: ¥{customer.totalAmount.toLocaleString()}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {/* 桌面端按钮 */}
                              <div className="hidden md:flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => router.push(`/customers/${customer.id}/edit`)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteCustomer(customer)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              
                              {/* 移动端下拉菜单 */}
                              <div className="md:hidden">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/customers/${customer.id}`)}
                                    >
                                      <Eye className="h-4 w-4 mr-2" />
                                      查看详情
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => router.push(`/customers/${customer.id}/edit`)}
                                    >
                                      <Edit className="h-4 w-4 mr-2" />
                                      编辑
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => handleDeleteCustomer(customer)}
                                      disabled={deleteMutation.isPending}
                                      className="text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      删除
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片列表 */}
              <div className="md:hidden space-y-4">
                {customersData?.data?.customers.map((customer) => {
                  const extendedInfo = customer.extendedInfo 
                    ? JSON.parse(customer.extendedInfo) 
                    : {}

                  return (
                    <Card key={customer.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="text-muted-foreground mt-1">
                            {getCustomerTypeIcon(customer.extendedInfo)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{customer.name}</div>
                            {customer.phone && (
                              <div className="text-sm text-muted-foreground">{customer.phone}</div>
                            )}
                            {customer.address && (
                              <div className="text-sm text-muted-foreground truncate">
                                {customer.address}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {extendedInfo.customerType && (
                                <Badge variant={CUSTOMER_TYPE_VARIANTS[extendedInfo.customerType]} className="text-xs">
                                  {CUSTOMER_TYPE_LABELS[extendedInfo.customerType]}
                                </Badge>
                              )}
                              {extendedInfo.level && (
                                <Badge variant={CUSTOMER_LEVEL_VARIANTS[extendedInfo.level]} className="text-xs">
                                  {CUSTOMER_LEVEL_LABELS[extendedInfo.level]}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/customers/${customer.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              查看详情
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => router.push(`/customers/${customer.id}/edit`)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteCustomer(customer)}
                              disabled={deleteMutation.isPending}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              删除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Card>
                  )
                })}
              </div>

              {/* 分页 */}
              {customersData?.data?.pagination && customersData.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    第 {customersData.data.pagination.page} 页，共 {customersData.data.pagination.totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(customersData.data.pagination.page - 1)}
                      disabled={customersData.data.pagination.page <= 1}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(customersData.data.pagination.page + 1)}
                      disabled={customersData.data.pagination.page >= customersData.data.pagination.totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, customer: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除客户</DialogTitle>
            <DialogDescription>
              您确定要删除客户 "{deleteDialog.customer?.name}" 吗？
              <br />
              <span className="text-destructive font-medium">
                此操作不可撤销，删除后相关的销售记录可能会受到影响。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, customer: null })}
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

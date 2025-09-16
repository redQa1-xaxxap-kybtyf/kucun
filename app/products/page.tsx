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
import { Plus, Search, Filter, Edit, Trash2, Package, AlertCircle, MoreHorizontal, Eye } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// API and Types
import { getProducts, deleteProduct, productQueryKeys } from '@/lib/api/products'
import { Product, ProductQueryParams } from '@/lib/types/product'
import { PRODUCT_UNIT_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_VARIANTS } from '@/lib/types/product'
import { productSearchSchema, ProductSearchFormData, productSearchDefaults } from '@/lib/validations/product'

export default function ProductsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, status } = useSession()
  const [queryParams, setQueryParams] = useState<ProductQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  })

  // 删除确认对话框状态
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean
    product: Product | null
  }>({
    open: false,
    product: null
  })

  // 搜索表单
  const searchForm = useForm<ProductSearchFormData>({
    resolver: zodResolver(productSearchSchema),
    defaultValues: productSearchDefaults,
  })

  // 获取产品列表
  const {
    data: productsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: productQueryKeys.list(queryParams),
    queryFn: () => getProducts(queryParams),
    enabled: !!session?.user?.id,
  })

  // 删除产品 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.lists() })
      setDeleteDialog({ open: false, product: null })
    },
    onError: (error) => {
      console.error('删除产品失败:', error)
    }
  })

  // 处理搜索
  const handleSearch = (data: ProductSearchFormData) => {
    const newParams: ProductQueryParams = {
      page: 1,
      limit: queryParams.limit,
      search: data.search || undefined,
      status: data.status || undefined,
      unit: data.unit || undefined,
      sortBy: data.sortBy,
      sortOrder: data.sortOrder,
    }
    setQueryParams(newParams)
  }

  // 处理分页
  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }))
  }

  // 重置搜索
  const handleResetSearch = () => {
    searchForm.reset(productSearchDefaults)
    setQueryParams({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  }

  // 处理删除产品
  const handleDeleteProduct = (product: Product) => {
    setDeleteDialog({ open: true, product })
  }

  // 确认删除
  const confirmDelete = async () => {
    if (deleteDialog.product) {
      await deleteMutation.mutateAsync(deleteDialog.product.id)
    }
  }

  // 认证检查
  if (status === 'loading') {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (!session) {
    router.push('/auth/signin')
    return null
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">产品管理</h1>
          <p className="text-muted-foreground">管理瓷砖产品信息和规格</p>
        </div>
        <Button onClick={() => router.push('/products/create')}>
          <Plus className="h-4 w-4 mr-2" />
          新增产品
        </Button>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            搜索筛选
          </CardTitle>
          <CardDescription>
            根据产品名称、编码、状态等条件筛选产品
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...searchForm}>
            <form onSubmit={searchForm.handleSubmit(handleSearch)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <FormField
                  control={searchForm.control}
                  name="search"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>搜索关键词</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="产品名称或编码"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>产品状态</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="all">全部状态</SelectItem>
                          <SelectItem value="active">启用</SelectItem>
                          <SelectItem value="inactive">停用</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={searchForm.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>计量单位</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择单位" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">全部单位</SelectItem>
                          <SelectItem value="piece">件</SelectItem>
                          <SelectItem value="sheet">片</SelectItem>
                          <SelectItem value="strip">条</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

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
                          <SelectItem value="createdAt">创建时间</SelectItem>
                          <SelectItem value="updatedAt">更新时间</SelectItem>
                          <SelectItem value="name">产品名称</SelectItem>
                          <SelectItem value="code">产品编码</SelectItem>
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

      {/* 产品列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="h-5 w-5 mr-2" />
            产品列表
            {productsData?.pagination && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (共 {productsData.pagination.total} 个产品)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error instanceof Error ? error.message : '获取产品列表失败'}
              </AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : productsData?.data?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无产品数据</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => router.push('/products/create')}
              >
                创建第一个产品
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>产品编码</TableHead>
                      <TableHead>产品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>每件片数</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productsData?.data?.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono">{product.code}</TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {product.specification || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PRODUCT_UNIT_LABELS[product.unit]}
                          </Badge>
                        </TableCell>
                        <TableCell>{product.piecesPerUnit}</TableCell>
                        <TableCell>
                          <Badge variant={PRODUCT_STATUS_VARIANTS[product.status]}>
                            {PRODUCT_STATUS_LABELS[product.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* 桌面端按钮 */}
                            <div className="hidden md:flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => router.push(`/products/${product.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
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
                                    onClick={() => router.push(`/products/${product.id}`)}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    查看详情
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(`/products/${product.id}/edit`)}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    编辑
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteProduct(product)}
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
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {productsData?.pagination && productsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    显示第 {((productsData.pagination.page - 1) * productsData.pagination.limit) + 1} - {Math.min(productsData.pagination.page * productsData.pagination.limit, productsData.pagination.total)} 条，
                    共 {productsData.pagination.total} 条记录
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={productsData.pagination.page <= 1}
                      onClick={() => handlePageChange(productsData.pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={productsData.pagination.page >= productsData.pagination.totalPages}
                      onClick={() => handlePageChange(productsData.pagination.page + 1)}
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
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, product: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除产品</DialogTitle>
            <DialogDescription>
              您确定要删除产品 "{deleteDialog.product?.name}" 吗？
              <br />
              <span className="text-destructive font-medium">
                此操作不可撤销，删除后相关的库存和销售记录可能会受到影响。
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, product: null })}
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

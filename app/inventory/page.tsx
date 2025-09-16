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

// Icons
import { 
  Plus, 
  Search, 
  Filter, 
  Package, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Calendar,
  Palette,
  RefreshCw,
  Download,
  BarChart3,
  Settings
} from 'lucide-react'

// API and Types
import { getInventories, getInventoryStats, inventoryQueryKeys } from '@/lib/api/inventory'
import { Inventory, InventoryQueryParams } from '@/lib/types/inventory'
import { 
  INVENTORY_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE,
  getInventoryStatus,
  calculateAvailableQuantity,
  formatInventoryQuantity,
  formatProductionDate
} from '@/lib/types/inventory'
import { 
  inventorySearchSchema, 
  InventorySearchFormData, 
  inventorySearchDefaults 
} from '@/lib/validations/inventory'

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // 状态管理
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  // 搜索表单
  const searchForm = useForm<InventorySearchFormData>({
    resolver: zodResolver(inventorySearchSchema),
    defaultValues: inventorySearchDefaults,
  })

  const searchParams = searchForm.watch()

  // 构建查询参数
  const queryParams: InventoryQueryParams = {
    page: currentPage,
    limit: DEFAULT_PAGE_SIZE,
    search: searchParams.search || undefined,
    productId: searchParams.productId || undefined,
    colorCode: searchParams.colorCode || undefined,
    lowStock: searchParams.lowStock,
    hasStock: searchParams.hasStock,
    productionDateStart: searchParams.productionDateStart || undefined,
    productionDateEnd: searchParams.productionDateEnd || undefined,
    sortBy: searchParams.sortBy,
    sortOrder: searchParams.sortOrder,
  }

  // 获取库存列表
  const {
    data: inventoriesData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: inventoryQueryKeys.list(queryParams),
    queryFn: () => getInventories(queryParams),
    enabled: !!session?.user?.id,
  })

  // 获取库存统计
  const { data: statsData } = useQuery({
    queryKey: inventoryQueryKeys.stats(),
    queryFn: () => getInventoryStats(),
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
    searchForm.reset(inventorySearchDefaults)
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
      const allIds = inventoriesData?.data?.inventories.map(item => item.id) || []
      setSelectedItems(allIds)
    } else {
      setSelectedItems([])
    }
  }

  if (status === 'loading' || isLoading) {
    return <InventoryPageSkeleton />
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
            {error instanceof Error ? error.message : '获取库存列表失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  const inventories = inventoriesData?.data?.inventories || []
  const pagination = inventoriesData?.data?.pagination
  const stats = statsData?.data

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">库存管理</h1>
          <p className="text-muted-foreground">管理产品库存，跟踪入库出库记录</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push('/inventory/inbound')}>
            <TrendingUp className="h-4 w-4 mr-2" />
            入库
          </Button>
          <Button variant="outline" onClick={() => router.push('/inventory/outbound')}>
            <TrendingDown className="h-4 w-4 mr-2" />
            出库
          </Button>
          <Button onClick={() => router.push('/inventory/adjust')}>
            <Settings className="h-4 w-4 mr-2" />
            调整
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总产品数</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProducts}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总库存量</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalQuantity.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">库存不足</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">缺货产品</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.outOfStockCount}</div>
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
                          placeholder="产品名称、编码..."
                          className="pl-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 色号 */}
              <FormField
                control={searchForm.control}
                name="colorCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>色号</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="输入色号..."
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* 库存状态 */}
              <FormField
                control={searchForm.control}
                name="lowStock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>库存状态</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        if (value === 'low') {
                          field.onChange(true)
                          searchForm.setValue('hasStock', undefined)
                        } else if (value === 'out') {
                          field.onChange(undefined)
                          searchForm.setValue('hasStock', false)
                        } else if (value === 'normal') {
                          field.onChange(false)
                          searchForm.setValue('hasStock', true)
                        } else {
                          field.onChange(undefined)
                          searchForm.setValue('hasStock', undefined)
                        }
                      }}
                      value={
                        field.value === true ? 'low' : 
                        searchForm.watch('hasStock') === false ? 'out' :
                        field.value === false && searchForm.watch('hasStock') === true ? 'normal' : ''
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="全部状态" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">全部状态</SelectItem>
                        <SelectItem value="normal">库存正常</SelectItem>
                        <SelectItem value="low">库存不足</SelectItem>
                        <SelectItem value="out">缺货</SelectItem>
                      </SelectContent>
                    </Select>
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
                        {INVENTORY_SORT_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {/* 生产日期范围 */}
              <FormField
                control={searchForm.control}
                name="productionDateStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生产日期（开始）</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={searchForm.control}
                name="productionDateEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生产日期（结束）</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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

      {/* 库存列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                库存列表
              </CardTitle>
              <CardDescription>
                {pagination && `共 ${pagination.total} 个库存项目，第 ${pagination.page} / ${pagination.totalPages} 页`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {inventories.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">暂无库存数据</h3>
              <p className="text-muted-foreground mb-4">
                还没有任何库存记录
              </p>
              <Button onClick={() => router.push('/inventory/inbound')}>
                <Plus className="h-4 w-4 mr-2" />
                开始入库
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
                          checked={selectedItems.length === inventories.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>产品</TableHead>
                      <TableHead>色号</TableHead>
                      <TableHead>生产日期</TableHead>
                      <TableHead>库存数量</TableHead>
                      <TableHead>预留数量</TableHead>
                      <TableHead>可用数量</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>更新时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventories.map((inventory) => {
                      const status = getInventoryStatus(inventory)
                      const availableQuantity = calculateAvailableQuantity(inventory)
                      
                      return (
                        <TableRow key={inventory.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedItems.includes(inventory.id)}
                              onCheckedChange={(checked) => handleSelectItem(inventory.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {inventory.product?.name || '未知产品'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {inventory.product?.code}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {inventory.colorCode ? (
                              <Badge variant="outline" className="flex items-center w-fit">
                                <Palette className="h-3 w-3 mr-1" />
                                {inventory.colorCode}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">无</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {inventory.productionDate ? (
                              <div className="flex items-center text-sm">
                                <Calendar className="h-3 w-3 mr-1" />
                                {formatProductionDate(inventory.productionDate)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">无</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {inventory.quantity} {inventory.product?.unit || '件'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-orange-600">
                              {inventory.reservedQuantity} {inventory.product?.unit || '件'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`font-medium ${status.color}`}>
                              {availableQuantity} {inventory.product?.unit || '件'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={status.status === 'normal' ? 'default' : 
                                     status.status === 'low_stock' ? 'secondary' : 'destructive'}
                            >
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {new Date(inventory.updatedAt).toLocaleDateString('zh-CN')}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* 移动端卡片 */}
              <div className="md:hidden space-y-4">
                {inventories.map((inventory) => {
                  const status = getInventoryStatus(inventory)
                  const availableQuantity = calculateAvailableQuantity(inventory)
                  
                  return (
                    <Card key={inventory.id} className="border-muted">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              checked={selectedItems.includes(inventory.id)}
                              onCheckedChange={(checked) => handleSelectItem(inventory.id, checked as boolean)}
                            />
                            <div className="font-medium text-sm">
                              {inventory.product?.name || '未知产品'}
                            </div>
                          </div>
                          <Badge 
                            variant={status.status === 'normal' ? 'default' : 
                                   status.status === 'low_stock' ? 'secondary' : 'destructive'}
                            className="text-xs"
                          >
                            {status.label}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">产品编码:</span>
                            <span>{inventory.product?.code || '无'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">色号:</span>
                            <span>{inventory.colorCode || '无'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">生产日期:</span>
                            <span>{inventory.productionDate ? formatProductionDate(inventory.productionDate) : '无'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">库存数量:</span>
                            <span className="font-medium">
                              {inventory.quantity} {inventory.product?.unit || '件'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">可用数量:</span>
                            <span className={`font-medium ${status.color}`}>
                              {availableQuantity} {inventory.product?.unit || '件'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">更新时间:</span>
                            <span>{new Date(inventory.updatedAt).toLocaleDateString('zh-CN')}</span>
                          </div>
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
function InventoryPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
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

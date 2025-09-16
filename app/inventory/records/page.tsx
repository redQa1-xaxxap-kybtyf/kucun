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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Icons
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Calendar,
  Palette,
  RefreshCw,
  Download,
  FileText,
  User,
  Building2
} from 'lucide-react'

// API and Types
import { getInboundRecords, getOutboundRecords, inventoryQueryKeys } from '@/lib/api/inventory'
import { InboundRecord, OutboundRecord, InboundRecordQueryParams, OutboundRecordQueryParams } from '@/lib/types/inventory'
import { 
  INBOUND_TYPE_LABELS,
  OUTBOUND_TYPE_LABELS,
  INBOUND_TYPE_VARIANTS,
  OUTBOUND_TYPE_VARIANTS,
  INBOUND_SORT_OPTIONS,
  OUTBOUND_SORT_OPTIONS,
  DEFAULT_PAGE_SIZE,
  formatProductionDate
} from '@/lib/types/inventory'
import { 
  inboundRecordSearchSchema, 
  outboundRecordSearchSchema,
  InboundRecordSearchFormData, 
  OutboundRecordSearchFormData,
  inboundRecordSearchDefaults,
  outboundRecordSearchDefaults
} from '@/lib/validations/inventory'

export default function InventoryRecordsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  // 状态管理
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>('inbound')
  const [inboundPage, setInboundPage] = useState(1)
  const [outboundPage, setOutboundPage] = useState(1)

  // 入库记录搜索表单
  const inboundSearchForm = useForm<InboundRecordSearchFormData>({
    resolver: zodResolver(inboundRecordSearchSchema),
    defaultValues: inboundRecordSearchDefaults,
  })

  // 出库记录搜索表单
  const outboundSearchForm = useForm<OutboundRecordSearchFormData>({
    resolver: zodResolver(outboundRecordSearchSchema),
    defaultValues: outboundRecordSearchDefaults,
  })

  const inboundSearchParams = inboundSearchForm.watch()
  const outboundSearchParams = outboundSearchForm.watch()

  // 构建入库查询参数
  const inboundQueryParams: InboundRecordQueryParams = {
    page: inboundPage,
    limit: DEFAULT_PAGE_SIZE,
    search: inboundSearchParams.search || undefined,
    type: inboundSearchParams.type || undefined,
    productId: inboundSearchParams.productId || undefined,
    userId: inboundSearchParams.userId || undefined,
    startDate: inboundSearchParams.startDate || undefined,
    endDate: inboundSearchParams.endDate || undefined,
    sortBy: inboundSearchParams.sortBy,
    sortOrder: inboundSearchParams.sortOrder,
  }

  // 构建出库查询参数
  const outboundQueryParams: OutboundRecordQueryParams = {
    page: outboundPage,
    limit: DEFAULT_PAGE_SIZE,
    search: outboundSearchParams.search || undefined,
    type: outboundSearchParams.type || undefined,
    productId: outboundSearchParams.productId || undefined,
    customerId: outboundSearchParams.customerId || undefined,
    salesOrderId: outboundSearchParams.salesOrderId || undefined,
    userId: outboundSearchParams.userId || undefined,
    startDate: outboundSearchParams.startDate || undefined,
    endDate: outboundSearchParams.endDate || undefined,
    sortBy: outboundSearchParams.sortBy,
    sortOrder: outboundSearchParams.sortOrder,
  }

  // 获取入库记录列表
  const {
    data: inboundRecordsData,
    isLoading: inboundLoading,
    error: inboundError,
    refetch: refetchInbound
  } = useQuery({
    queryKey: inventoryQueryKeys.inboundList(inboundQueryParams),
    queryFn: () => getInboundRecords(inboundQueryParams),
    enabled: !!session?.user?.id && activeTab === 'inbound',
  })

  // 获取出库记录列表
  const {
    data: outboundRecordsData,
    isLoading: outboundLoading,
    error: outboundError,
    refetch: refetchOutbound
  } = useQuery({
    queryKey: inventoryQueryKeys.outboundList(outboundQueryParams),
    queryFn: () => getOutboundRecords(outboundQueryParams),
    enabled: !!session?.user?.id && activeTab === 'outbound',
  })

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 重置搜索
  const resetInboundSearch = () => {
    inboundSearchForm.reset(inboundRecordSearchDefaults)
    setInboundPage(1)
  }

  const resetOutboundSearch = () => {
    outboundSearchForm.reset(outboundRecordSearchDefaults)
    setOutboundPage(1)
  }

  if (status === 'loading') {
    return <InventoryRecordsPageSkeleton />
  }

  if (!session) {
    return null
  }

  const inboundRecords = inboundRecordsData?.data?.records || []
  const inboundPagination = inboundRecordsData?.data?.pagination
  const outboundRecords = outboundRecordsData?.data?.records || []
  const outboundPagination = outboundRecordsData?.data?.pagination

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">库存记录</h1>
          <p className="text-muted-foreground">查看入库和出库操作记录</p>
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
        </div>
      </div>

      {/* 记录列表 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'inbound' | 'outbound')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inbound" className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            入库记录
          </TabsTrigger>
          <TabsTrigger value="outbound" className="flex items-center">
            <TrendingDown className="h-4 w-4 mr-2" />
            出库记录
          </TabsTrigger>
        </TabsList>

        {/* 入库记录 */}
        <TabsContent value="inbound" className="space-y-6">
          {/* 搜索和筛选 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Filter className="h-4 w-4 mr-2" />
                搜索筛选
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...inboundSearchForm}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 搜索关键词 */}
                  <FormField
                    control={inboundSearchForm.control}
                    name="search"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>搜索关键词</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="入库单号、产品名称..."
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 入库类型 */}
                  <FormField
                    control={inboundSearchForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>入库类型</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="全部类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">全部类型</SelectItem>
                            {Object.entries(INBOUND_TYPE_LABELS).map(([value, label]) => (
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
                    control={inboundSearchForm.control}
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
                    control={inboundSearchForm.control}
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
                    control={inboundSearchForm.control}
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
                            {INBOUND_SORT_OPTIONS.map(option => (
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
                    control={inboundSearchForm.control}
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
                  <Button type="button" variant="outline" onClick={resetInboundSearch}>
                    重置
                  </Button>
                  <Button type="button" onClick={() => refetchInbound()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          {/* 入库记录列表 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    入库记录
                  </CardTitle>
                  <CardDescription>
                    {inboundPagination && `共 ${inboundPagination.total} 条记录，第 ${inboundPagination.page} / ${inboundPagination.totalPages} 页`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {inboundError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {inboundError instanceof Error ? inboundError.message : '获取入库记录失败'}
                  </AlertDescription>
                </Alert>
              ) : inboundLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : inboundRecords.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">暂无入库记录</h3>
                  <p className="text-muted-foreground mb-4">
                    还没有任何入库操作记录
                  </p>
                  <Button onClick={() => router.push('/inventory/inbound')}>
                    <TrendingUp className="h-4 w-4 mr-2" />
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
                          <TableHead>入库单号</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead>色号</TableHead>
                          <TableHead>生产日期</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>单位成本</TableHead>
                          <TableHead>总成本</TableHead>
                          <TableHead>操作员</TableHead>
                          <TableHead>入库时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inboundRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="font-mono font-medium text-sm">
                                {record.recordNumber}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={INBOUND_TYPE_VARIANTS[record.type]}>
                                {INBOUND_TYPE_LABELS[record.type]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">
                                  {record.product?.name || '未知产品'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {record.product?.code}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {record.colorCode ? (
                                <Badge variant="outline" className="text-xs">
                                  <Palette className="h-3 w-3 mr-1" />
                                  {record.colorCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.productionDate ? (
                                <div className="flex items-center text-sm">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatProductionDate(record.productionDate)}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-sm">
                                {record.quantity} {record.product?.unit || '件'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {record.unitCost ? (
                                <span className="font-medium text-sm">
                                  ¥{record.unitCost.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.totalCost ? (
                                <span className="font-medium text-green-600 text-sm">
                                  ¥{record.totalCost.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <User className="h-3 w-3 mr-1" />
                                {record.user?.name || '未知用户'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {new Date(record.createdAt).toLocaleString('zh-CN')}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {inboundRecords.map((record) => (
                      <Card key={record.id} className="border-muted">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-mono font-medium text-sm">
                              {record.recordNumber}
                            </div>
                            <Badge variant={INBOUND_TYPE_VARIANTS[record.type]} className="text-xs">
                              {INBOUND_TYPE_LABELS[record.type]}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">产品:</span>
                              <span>{record.product?.name || '未知产品'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">色号:</span>
                              <span>{record.colorCode || '无'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">数量:</span>
                              <span className="font-medium">
                                {record.quantity} {record.product?.unit || '件'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">总成本:</span>
                              <span className="font-medium text-green-600">
                                {record.totalCost ? `¥${record.totalCost.toLocaleString()}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">操作员:</span>
                              <span>{record.user?.name || '未知用户'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">入库时间:</span>
                              <span>{new Date(record.createdAt).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* 分页 */}
                  {inboundPagination && inboundPagination.totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInboundPage(inboundPage - 1)}
                        disabled={inboundPage <= 1}
                      >
                        上一页
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        第 {inboundPage} / {inboundPagination.totalPages} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInboundPage(inboundPage + 1)}
                        disabled={inboundPage >= inboundPagination.totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 出库记录 */}
        <TabsContent value="outbound" className="space-y-6">
          {/* 搜索和筛选 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-base">
                <Filter className="h-4 w-4 mr-2" />
                搜索筛选
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...outboundSearchForm}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 搜索关键词 */}
                  <FormField
                    control={outboundSearchForm.control}
                    name="search"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>搜索关键词</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="出库单号、产品名称..."
                              className="pl-10"
                              {...field}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {/* 出库类型 */}
                  <FormField
                    control={outboundSearchForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>出库类型</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="全部类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">全部类型</SelectItem>
                            {Object.entries(OUTBOUND_TYPE_LABELS).map(([value, label]) => (
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
                    control={outboundSearchForm.control}
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
                    control={outboundSearchForm.control}
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
                    control={outboundSearchForm.control}
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
                            {OUTBOUND_SORT_OPTIONS.map(option => (
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
                    control={outboundSearchForm.control}
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
                  <Button type="button" variant="outline" onClick={resetOutboundSearch}>
                    重置
                  </Button>
                  <Button type="button" onClick={() => refetchOutbound()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    刷新
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          {/* 出库记录列表 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <TrendingDown className="h-5 w-5 mr-2" />
                    出库记录
                  </CardTitle>
                  <CardDescription>
                    {outboundPagination && `共 ${outboundPagination.total} 条记录，第 ${outboundPagination.page} / ${outboundPagination.totalPages} 页`}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {outboundError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {outboundError instanceof Error ? outboundError.message : '获取出库记录失败'}
                  </AlertDescription>
                </Alert>
              ) : outboundLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : outboundRecords.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">暂无出库记录</h3>
                  <p className="text-muted-foreground mb-4">
                    还没有任何出库操作记录
                  </p>
                  <Button onClick={() => router.push('/inventory/outbound')}>
                    <TrendingDown className="h-4 w-4 mr-2" />
                    开始出库
                  </Button>
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>出库单号</TableHead>
                          <TableHead>类型</TableHead>
                          <TableHead>产品</TableHead>
                          <TableHead>色号</TableHead>
                          <TableHead>生产日期</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>单位成本</TableHead>
                          <TableHead>总成本</TableHead>
                          <TableHead>客户</TableHead>
                          <TableHead>操作员</TableHead>
                          <TableHead>出库时间</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboundRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="font-mono font-medium text-sm">
                                {record.recordNumber}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={OUTBOUND_TYPE_VARIANTS[record.type]}>
                                {OUTBOUND_TYPE_LABELS[record.type]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium text-sm">
                                  {record.product?.name || '未知产品'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {record.product?.code}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {record.colorCode ? (
                                <Badge variant="outline" className="text-xs">
                                  <Palette className="h-3 w-3 mr-1" />
                                  {record.colorCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.productionDate ? (
                                <div className="flex items-center text-sm">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatProductionDate(record.productionDate)}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-sm">
                                {record.quantity} {record.product?.unit || '件'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {record.unitCost ? (
                                <span className="font-medium text-sm">
                                  ¥{record.unitCost.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.totalCost ? (
                                <span className="font-medium text-red-600 text-sm">
                                  ¥{record.totalCost.toLocaleString()}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {record.customerId ? (
                                <div className="flex items-center text-sm">
                                  <Building2 className="h-3 w-3 mr-1" />
                                  客户名称
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center text-sm">
                                <User className="h-3 w-3 mr-1" />
                                {record.user?.name || '未知用户'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {new Date(record.createdAt).toLocaleString('zh-CN')}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {outboundRecords.map((record) => (
                      <Card key={record.id} className="border-muted">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="font-mono font-medium text-sm">
                              {record.recordNumber}
                            </div>
                            <Badge variant={OUTBOUND_TYPE_VARIANTS[record.type]} className="text-xs">
                              {OUTBOUND_TYPE_LABELS[record.type]}
                            </Badge>
                          </div>
                          
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">产品:</span>
                              <span>{record.product?.name || '未知产品'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">色号:</span>
                              <span>{record.colorCode || '无'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">数量:</span>
                              <span className="font-medium">
                                {record.quantity} {record.product?.unit || '件'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">总成本:</span>
                              <span className="font-medium text-red-600">
                                {record.totalCost ? `¥${record.totalCost.toLocaleString()}` : '-'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">操作员:</span>
                              <span>{record.user?.name || '未知用户'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">出库时间:</span>
                              <span>{new Date(record.createdAt).toLocaleDateString('zh-CN')}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* 分页 */}
                  {outboundPagination && outboundPagination.totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutboundPage(outboundPage - 1)}
                        disabled={outboundPage <= 1}
                      >
                        上一页
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        第 {outboundPage} / {outboundPagination.totalPages} 页
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOutboundPage(outboundPage + 1)}
                        disabled={outboundPage >= outboundPagination.totalPages}
                      >
                        下一页
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// 加载骨架屏
function InventoryRecordsPageSkeleton() {
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
        </div>
      </div>

      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        
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
    </div>
  )
}

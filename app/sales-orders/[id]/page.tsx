'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

// UI Components
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

// Icons
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Copy, 
  FileText, 
  AlertCircle, 
  ShoppingCart,
  Building2,
  User,
  Calendar,
  Package,
  Palette,
  Calculator,
  RefreshCw
} from 'lucide-react'

// API and Types
import { 
  getSalesOrder, 
  deleteSalesOrder, 
  copySalesOrder, 
  updateSalesOrderStatus,
  salesOrderQueryKeys 
} from '@/lib/api/sales-orders'
import { SalesOrder, SalesOrderStatus } from '@/lib/types/sales-order'
import { 
  SALES_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_VARIANTS,
  SALES_ORDER_STATUS_TRANSITIONS,
  canTransitionToStatus,
  formatProductionDate
} from '@/lib/types/sales-order'

interface SalesOrderDetailPageProps {
  params: {
    id: string
  }
}

export default function SalesOrderDetailPage({ params }: SalesOrderDetailPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { id } = params

  // 状态管理
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<SalesOrderStatus>('draft')
  const [statusRemarks, setStatusRemarks] = useState('')

  // 获取销售订单详情
  const {
    data: salesOrderData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: salesOrderQueryKeys.detail(id),
    queryFn: () => getSalesOrder(id),
    enabled: !!session?.user?.id && !!id,
  })

  // 删除销售订单 Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSalesOrder,
    onSuccess: () => {
      router.push('/sales-orders')
    }
  })

  // 复制销售订单 Mutation
  const copyMutation = useMutation({
    mutationFn: copySalesOrder,
    onSuccess: (response) => {
      router.push(`/sales-orders/${response.data.id}/edit`)
    }
  })

  // 更新订单状态 Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ status, remarks }: { status: SalesOrderStatus; remarks?: string }) =>
      updateSalesOrderStatus(id, status, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() })
      setStatusDialogOpen(false)
      setStatusRemarks('')
    }
  })

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 处理删除
  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    deleteMutation.mutate(id)
  }

  // 处理复制
  const handleCopy = () => {
    copyMutation.mutate(id)
  }

  // 处理状态更新
  const handleStatusUpdate = (newStatus: SalesOrderStatus) => {
    setSelectedStatus(newStatus)
    setStatusDialogOpen(true)
  }

  const confirmStatusUpdate = () => {
    updateStatusMutation.mutate({
      status: selectedStatus,
      remarks: statusRemarks || undefined
    })
  }

  if (status === 'loading' || isLoading) {
    return <SalesOrderDetailPageSkeleton />
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/sales-orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">销售订单详情</h1>
              <p className="text-muted-foreground">查看销售订单的详细信息</p>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : '获取销售订单信息失败'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={() => refetch()}>重试</Button>
            <Button variant="outline" onClick={() => router.push('/sales-orders')}>
              返回列表
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!salesOrderData?.data) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/sales-orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">销售订单详情</h1>
              <p className="text-muted-foreground">查看销售订单的详细信息</p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>未找到指定的销售订单</AlertDescription>
          </Alert>

          <Button variant="outline" onClick={() => router.push('/sales-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const salesOrder = salesOrderData.data
  const canEdit = ['draft', 'confirmed'].includes(salesOrder.status)
  const availableStatuses = SALES_ORDER_STATUS_TRANSITIONS[salesOrder.status] || []

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/sales-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center space-x-3">
            <div className="text-muted-foreground">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{salesOrder.orderNumber}</h1>
              <div className="flex items-center space-x-2">
                <Badge variant={SALES_ORDER_STATUS_VARIANTS[salesOrder.status]}>
                  {SALES_ORDER_STATUS_LABELS[salesOrder.status]}
                </Badge>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {new Date(salesOrder.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 状态更新按钮 */}
          {availableStatuses.length > 0 && (
            <div className="flex space-x-1">
              {availableStatuses.map(status => (
                <Button
                  key={status}
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusUpdate(status)}
                  disabled={updateStatusMutation.isPending}
                >
                  {SALES_ORDER_STATUS_LABELS[status]}
                </Button>
              ))}
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={copyMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            复制
          </Button>
          
          {canEdit && (
            <Button
              size="sm"
              onClick={() => router.push(`/sales-orders/${salesOrder.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              编辑
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                订单信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">订单号</label>
                  <p className="font-mono font-medium">{salesOrder.orderNumber}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">订单状态</label>
                  <div className="mt-1">
                    <Badge variant={SALES_ORDER_STATUS_VARIANTS[salesOrder.status]}>
                      {SALES_ORDER_STATUS_LABELS[salesOrder.status]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    客户
                  </label>
                  <p className="font-medium">{salesOrder.customer?.name || '未知客户'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <User className="h-4 w-4 mr-1" />
                    销售员
                  </label>
                  <p className="font-medium">{salesOrder.user?.name || '未知销售员'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calculator className="h-4 w-4 mr-1" />
                    订单金额
                  </label>
                  <p className="text-2xl font-bold text-green-600">
                    ¥{salesOrder.totalAmount.toLocaleString()}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    创建时间
                  </label>
                  <p className="font-medium">
                    {new Date(salesOrder.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>

              {salesOrder.remarks && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">备注信息</label>
                    <p className="mt-1 text-sm leading-relaxed bg-muted/50 p-3 rounded-md">
                      {salesOrder.remarks}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 订单明细 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  订单明细
                </span>
                <Badge variant="outline">
                  共 {salesOrder.items?.length || 0} 项
                </Badge>
              </CardTitle>
              <CardDescription>
                订单中包含的产品明细信息
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!salesOrder.items || salesOrder.items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无订单明细</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 桌面端表格 */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>产品</TableHead>
                          <TableHead>色号</TableHead>
                          <TableHead>生产日期</TableHead>
                          <TableHead>数量</TableHead>
                          <TableHead>单价</TableHead>
                          <TableHead>小计</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesOrder.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">
                                  {item.product?.name || '未知产品'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.product?.code}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.colorCode ? (
                                <Badge variant="outline" className="flex items-center">
                                  <Palette className="h-3 w-3 mr-1" />
                                  {item.colorCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.productionDate ? (
                                formatProductionDate(item.productionDate)
                              ) : (
                                <span className="text-muted-foreground">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {item.quantity} {item.product?.unit || '件'}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                ¥{item.unitPrice.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium text-green-600">
                                ¥{item.subtotal.toLocaleString()}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {salesOrder.items.map((item) => (
                      <Card key={item.id} className="border-muted">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">
                                  {item.product?.name || '未知产品'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {item.product?.code}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-green-600">
                                  ¥{item.subtotal.toLocaleString()}
                                </div>
                                <div className="text-sm text-muted-foreground">小计</div>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">色号:</span>
                                <span className="ml-2">
                                  {item.colorCode || '无'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">生产日期:</span>
                                <span className="ml-2">
                                  {item.productionDate ? formatProductionDate(item.productionDate) : '无'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">数量:</span>
                                <span className="ml-2 font-medium">
                                  {item.quantity} {item.product?.unit || '件'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">单价:</span>
                                <span className="ml-2 font-medium">
                                  ¥{item.unitPrice.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* 总计 */}
                  <Separator />
                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground mb-1">订单总金额</div>
                      <div className="text-2xl font-bold text-green-600">
                        ¥{salesOrder.totalAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 客户信息 */}
          {salesOrder.customer && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">客户信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">客户名称</label>
                  <p className="font-medium">{salesOrder.customer.name}</p>
                </div>
                {salesOrder.customer.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">联系电话</label>
                    <p className="font-mono">{salesOrder.customer.phone}</p>
                  </div>
                )}
                {salesOrder.customer.address && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">客户地址</label>
                    <p className="text-sm leading-relaxed">{salesOrder.customer.address}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 操作记录 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">操作记录</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">创建时间</span>
                <span className="text-sm">
                  {new Date(salesOrder.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">更新时间</span>
                <span className="text-sm">
                  {new Date(salesOrder.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 危险操作 */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base text-destructive">危险操作</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                删除订单
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除销售订单</DialogTitle>
            <DialogDescription>
              您确定要删除订单 "{salesOrder.orderNumber}" 吗？此操作不可撤销。
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

      {/* 状态更新对话框 */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新订单状态</DialogTitle>
            <DialogDescription>
              将订单状态从 "{SALES_ORDER_STATUS_LABELS[salesOrder.status]}" 更新为 "{SALES_ORDER_STATUS_LABELS[selectedStatus]}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">备注信息（可选）</label>
              <Textarea
                placeholder="记录状态更新的原因或说明..."
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              disabled={updateStatusMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={confirmStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? '更新中...' : '确认更新'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 加载骨架屏
function SalesOrderDetailPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-20" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  )
}

'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Icons
import { 
  ArrowLeft, 
  Edit, 
  Copy, 
  Trash2, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Package,
  Palette,
  Calculator,
  Truck,
  FileText
} from 'lucide-react'

// API and Types
import { 
  getPurchaseOrder, 
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  duplicatePurchaseOrder,
  purchaseOrderQueryKeys 
} from '@/lib/api/purchase-orders'
import { PurchaseOrder } from '@/lib/types/purchase-order'
import { 
  getPurchaseOrderStatus,
  formatPurchaseOrderAmount,
  formatDeliveryDate,
  isValidStatusTransition,
  PURCHASE_ORDER_STATUS_LABELS
} from '@/lib/types/purchase-order'

interface PurchaseOrderDetailPageProps {
  params: {
    id: string
  }
}

export default function PurchaseOrderDetailPage({ params }: PurchaseOrderDetailPageProps) {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  // 状态管理
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [actualDeliveryDate, setActualDeliveryDate] = useState<string>('')
  const [statusRemarks, setStatusRemarks] = useState<string>('')

  // 认证检查
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [sessionStatus, router])

  // 获取采购订单详情
  const {
    data: purchaseOrderData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: purchaseOrderQueryKeys.detail(params.id),
    queryFn: () => getPurchaseOrder(params.id),
    enabled: !!session?.user?.id && !!params.id,
  })

  // 状态更新 Mutation
  const statusUpdateMutation = useMutation({
    mutationFn: ({ status, actualDeliveryDate, remarks }: { 
      status: string
      actualDeliveryDate?: string
      remarks?: string 
    }) => updatePurchaseOrderStatus(params.id, status, actualDeliveryDate, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderQueryKeys.detail(params.id) })
      queryClient.invalidateQueries({ queryKey: purchaseOrderQueryKeys.lists() })
      setShowStatusDialog(false)
      setNewStatus('')
      setActualDeliveryDate('')
      setStatusRemarks('')
    },
    onError: (error) => {
      console.error('状态更新失败:', error)
    }
  })

  // 删除 Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deletePurchaseOrder(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderQueryKeys.lists() })
      router.push('/purchase-orders')
    },
    onError: (error) => {
      console.error('删除失败:', error)
    }
  })

  // 复制 Mutation
  const duplicateMutation = useMutation({
    mutationFn: () => duplicatePurchaseOrder(params.id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: purchaseOrderQueryKeys.lists() })
      router.push(`/purchase-orders/${response.data.id}/edit`)
    },
    onError: (error) => {
      console.error('复制失败:', error)
    }
  })

  // 处理状态更新
  const handleStatusUpdate = (status: string) => {
    setNewStatus(status)
    setShowStatusDialog(true)
    
    // 如果是收货或完成状态，预设当前日期
    if (status === 'received' || status === 'completed') {
      setActualDeliveryDate(new Date().toISOString().split('T')[0])
    }
  }

  // 确认状态更新
  const confirmStatusUpdate = () => {
    statusUpdateMutation.mutate({
      status: newStatus,
      actualDeliveryDate: actualDeliveryDate || undefined,
      remarks: statusRemarks || undefined
    })
  }

  // 确认删除
  const confirmDelete = () => {
    deleteMutation.mutate()
  }

  if (sessionStatus === 'loading' || isLoading) {
    return <PurchaseOrderDetailPageSkeleton />
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
            {error instanceof Error ? error.message : '获取采购订单详情失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4 space-x-2">
          <Button onClick={() => refetch()}>重试</Button>
          <Button variant="outline" onClick={() => router.push('/purchase-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (!purchaseOrderData?.data) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            未找到指定的采购订单
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push('/purchase-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const purchaseOrder = purchaseOrderData.data
  const status = getPurchaseOrderStatus(purchaseOrder)
  const items = purchaseOrder.items || []

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/purchase-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">采购订单详情</h1>
            <p className="text-muted-foreground">订单号: {purchaseOrder.orderNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => duplicateMutation.mutate()}
            disabled={duplicateMutation.isPending}
          >
            <Copy className="h-4 w-4 mr-2" />
            复制订单
          </Button>
          {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'confirmed') && (
            <Button
              variant="outline"
              onClick={() => router.push(`/purchase-orders/${purchaseOrder.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              编辑订单
            </Button>
          )}
          {purchaseOrder.status === 'draft' && (
            <Button onClick={() => handleStatusUpdate('confirmed')}>
              <CheckCircle className="h-4 w-4 mr-2" />
              确认订单
            </Button>
          )}
          {purchaseOrder.status === 'confirmed' && (
            <Button onClick={() => handleStatusUpdate('received')}>
              <Truck className="h-4 w-4 mr-2" />
              标记收货
            </Button>
          )}
        </div>
      </div>

      {/* 订单基础信息 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* 基础信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                基础信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">订单号</Label>
                  <div className="font-mono font-medium">{purchaseOrder.orderNumber}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">订单状态</Label>
                  <div>
                    <Badge variant={status.variant} className="mt-1">
                      {status.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">供应商</Label>
                  <div className="flex items-center mt-1">
                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{purchaseOrder.supplier?.name || '未知供应商'}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">创建人</Label>
                  <div className="flex items-center mt-1">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{purchaseOrder.user?.name || '未知用户'}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">预期交货日期</Label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>
                      {purchaseOrder.expectedDeliveryDate ? 
                        formatDeliveryDate(purchaseOrder.expectedDeliveryDate) : '未设置'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">实际交货日期</Label>
                  <div className="flex items-center mt-1">
                    <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>
                      {purchaseOrder.actualDeliveryDate ? 
                        formatDeliveryDate(purchaseOrder.actualDeliveryDate) : '未交货'}
                    </span>
                  </div>
                </div>
              </div>
              
              {purchaseOrder.remarks && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">备注</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                      {purchaseOrder.remarks}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 采购明细 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                采购明细
              </CardTitle>
              <CardDescription>
                共 {items.length} 个明细项目
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">暂无采购明细</p>
                </div>
              ) : (
                <>
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
                        {items.map((item) => (
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
                                <Badge variant="outline" className="text-xs">
                                  <Palette className="h-3 w-3 mr-1" />
                                  {item.colorCode}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">无</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.productionDate ? (
                                <div className="flex items-center text-sm">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {item.productionDate}
                                </div>
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
                                {formatPurchaseOrderAmount(item.unitPrice)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {formatPurchaseOrderAmount(item.subtotal)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="md:hidden space-y-4">
                    {items.map((item) => (
                      <Card key={item.id} className="border-muted">
                        <CardContent className="p-4">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {item.product?.name || '未知产品'}
                              </span>
                              <span className="font-medium">
                                {formatPurchaseOrderAmount(item.subtotal)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">产品编码:</span>
                              <span>{item.product?.code || '无'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">色号:</span>
                              <span>{item.colorCode || '无'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">数量:</span>
                              <span>{item.quantity} {item.product?.unit || '件'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">单价:</span>
                              <span>{formatPurchaseOrderAmount(item.unitPrice)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* 总计 */}
                  <Separator />
                  <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center space-x-2">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        共 {items.length} 个明细项目
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {formatPurchaseOrderAmount(purchaseOrder.totalAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground">订单总金额</div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 快速操作 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">快速操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {purchaseOrder.status === 'draft' && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('confirmed')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  确认订单
                </Button>
              )}
              
              {purchaseOrder.status === 'confirmed' && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('received')}
                >
                  <Truck className="h-4 w-4 mr-2" />
                  标记收货
                </Button>
              )}
              
              {purchaseOrder.status === 'received' && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('completed')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  完成订单
                </Button>
              )}
              
              {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'confirmed') && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('cancelled')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  取消订单
                </Button>
              )}
              
              {(purchaseOrder.status === 'draft' || purchaseOrder.status === 'cancelled') && (
                <Button 
                  className="w-full justify-start" 
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除订单
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 订单信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">订单信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建时间:</span>
                <span>{new Date(purchaseOrder.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新时间:</span>
                <span>{new Date(purchaseOrder.updatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">明细数量:</span>
                <span>{items.length} 项</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 状态更新对话框 */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更新订单状态</DialogTitle>
            <DialogDescription>
              将订单状态更新为：{PURCHASE_ORDER_STATUS_LABELS[newStatus as keyof typeof PURCHASE_ORDER_STATUS_LABELS]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {(newStatus === 'received' || newStatus === 'completed') && (
              <div>
                <Label htmlFor="actualDeliveryDate">实际交货日期 *</Label>
                <Input
                  id="actualDeliveryDate"
                  type="date"
                  value={actualDeliveryDate}
                  onChange={(e) => setActualDeliveryDate(e.target.value)}
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="statusRemarks">备注</Label>
              <Textarea
                id="statusRemarks"
                placeholder="状态更新备注..."
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={confirmStatusUpdate}
              disabled={statusUpdateMutation.isPending}
            >
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除采购订单 {purchaseOrder.orderNumber} 吗？此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// 加载骨架屏
function PurchaseOrderDetailPageSkeleton() {
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
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

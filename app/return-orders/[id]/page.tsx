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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  FileText,
  RotateCcw,
  DollarSign
} from 'lucide-react'

// API and Types
import { 
  getReturnOrder, 
  updateReturnOrderStatus,
  deleteReturnOrder,
  duplicateReturnOrder,
  approveReturnOrder,
  returnOrderQueryKeys 
} from '@/lib/api/return-orders'
import { ReturnOrder } from '@/lib/types/return-order'
import { 
  getReturnOrderStatus,
  formatReturnAmount,
  formatReturnDate,
  isValidReturnStatusTransition,
  RETURN_ORDER_STATUS_LABELS,
  RETURN_ORDER_TYPE_LABELS,
  RETURN_PROCESS_TYPE_LABELS,
  canEditReturnOrder,
  canApproveReturnOrder,
  canProcessReturnOrder,
  canCompleteReturnOrder,
  canCancelReturnOrder
} from '@/lib/types/return-order'

interface ReturnOrderDetailPageProps {
  params: {
    id: string
  }
}

export default function ReturnOrderDetailPage({ params }: ReturnOrderDetailPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  
  // 状态管理
  const [showStatusDialog, setShowStatusDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<string>('')
  const [statusRemarks, setStatusRemarks] = useState<string>('')
  const [refundAmount, setRefundAmount] = useState<string>('')
  const [approvalDecision, setApprovalDecision] = useState<boolean>(true)

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 获取退货订单详情
  const {
    data: returnOrderData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: returnOrderQueryKeys.detail(params.id),
    queryFn: () => getReturnOrder(params.id),
    enabled: !!session?.user?.id && !!params.id,
  })

  // 状态更新 Mutation
  const statusUpdateMutation = useMutation({
    mutationFn: ({ status, remarks, refundAmount }: { 
      status: string
      remarks?: string
      refundAmount?: number 
    }) => updateReturnOrderStatus(params.id, status, remarks, refundAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.detail(params.id) })
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() })
      setShowStatusDialog(false)
      setNewStatus('')
      setStatusRemarks('')
      setRefundAmount('')
    },
    onError: (error) => {
      console.error('状态更新失败:', error)
    }
  })

  // 审核 Mutation
  const approvalMutation = useMutation({
    mutationFn: ({ approved, remarks, refundAmount }: { 
      approved: boolean
      remarks?: string
      refundAmount?: number 
    }) => approveReturnOrder(params.id, { approved, remarks, refundAmount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.detail(params.id) })
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() })
      setShowApprovalDialog(false)
      setApprovalDecision(true)
      setStatusRemarks('')
      setRefundAmount('')
    },
    onError: (error) => {
      console.error('审核失败:', error)
    }
  })

  // 删除 Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteReturnOrder(params.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() })
      router.push('/return-orders')
    },
    onError: (error) => {
      console.error('删除失败:', error)
    }
  })

  // 复制 Mutation
  const duplicateMutation = useMutation({
    mutationFn: () => duplicateReturnOrder(params.id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: returnOrderQueryKeys.lists() })
      router.push(`/return-orders/${response.data.id}/edit`)
    },
    onError: (error) => {
      console.error('复制失败:', error)
    }
  })

  // 处理状态更新
  const handleStatusUpdate = (status: string) => {
    setNewStatus(status)
    setShowStatusDialog(true)
    
    // 如果是完成状态，预设退款金额
    if (status === 'completed' && returnOrderData?.data) {
      setRefundAmount(returnOrderData.data.totalAmount.toString())
    }
  }

  // 处理审核
  const handleApproval = () => {
    setShowApprovalDialog(true)
    if (returnOrderData?.data) {
      setRefundAmount(returnOrderData.data.totalAmount.toString())
    }
  }

  // 确认状态更新
  const confirmStatusUpdate = () => {
    statusUpdateMutation.mutate({
      status: newStatus,
      remarks: statusRemarks || undefined,
      refundAmount: refundAmount ? parseFloat(refundAmount) : undefined
    })
  }

  // 确认审核
  const confirmApproval = () => {
    approvalMutation.mutate({
      approved: approvalDecision,
      remarks: statusRemarks || undefined,
      refundAmount: approvalDecision && refundAmount ? parseFloat(refundAmount) : undefined
    })
  }

  // 确认删除
  const confirmDelete = () => {
    deleteMutation.mutate()
  }

  if (status === 'loading' || isLoading) {
    return <ReturnOrderDetailPageSkeleton />
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
            {error instanceof Error ? error.message : '获取退货订单详情失败'}
          </AlertDescription>
        </Alert>
        <div className="mt-4 space-x-2">
          <Button onClick={() => refetch()}>重试</Button>
          <Button variant="outline" onClick={() => router.push('/return-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  if (!returnOrderData?.data) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            未找到指定的退货订单
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button variant="outline" onClick={() => router.push('/return-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  const returnOrder = returnOrderData.data
  const orderStatus = getReturnOrderStatus(returnOrder)
  const items = returnOrder.items || []

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/return-orders')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回列表
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">退货订单详情</h1>
            <p className="text-muted-foreground">退货单号: {returnOrder.returnNumber}</p>
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
          {canEditReturnOrder(returnOrder) && (
            <Button
              variant="outline"
              onClick={() => router.push(`/return-orders/${returnOrder.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              编辑订单
            </Button>
          )}
          {canApproveReturnOrder(returnOrder) && (
            <Button onClick={handleApproval}>
              <CheckCircle className="h-4 w-4 mr-2" />
              审核订单
            </Button>
          )}
          {canProcessReturnOrder(returnOrder) && (
            <Button onClick={() => handleStatusUpdate('processing')}>
              <Package className="h-4 w-4 mr-2" />
              开始处理
            </Button>
          )}
          {canCompleteReturnOrder(returnOrder) && (
            <Button onClick={() => handleStatusUpdate('completed')}>
              <CheckCircle className="h-4 w-4 mr-2" />
              完成退货
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
                  <Label className="text-sm font-medium text-muted-foreground">退货单号</Label>
                  <div className="font-mono font-medium">{returnOrder.returnNumber}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">订单状态</Label>
                  <div>
                    <Badge variant={orderStatus.variant} className="mt-1">
                      {orderStatus.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">关联销售单</Label>
                  <div className="font-mono">
                    {returnOrder.salesOrder?.orderNumber || '未知订单'}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">客户</Label>
                  <div className="flex items-center mt-1">
                    <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{returnOrder.customer?.name || '未知客户'}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">退货类型</Label>
                  <div>
                    <Badge variant="outline" className="mt-1">
                      {RETURN_ORDER_TYPE_LABELS[returnOrder.type]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">处理方式</Label>
                  <div>
                    <Badge variant="outline" className="mt-1">
                      {RETURN_PROCESS_TYPE_LABELS[returnOrder.processType]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">创建人</Label>
                  <div className="flex items-center mt-1">
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span>{returnOrder.user?.name || '未知用户'}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">退款金额</Label>
                  <div className="flex items-center mt-1">
                    <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium text-green-600">
                      {formatReturnAmount(returnOrder.refundAmount || 0)}
                    </span>
                  </div>
                </div>
              </div>
              
              {returnOrder.reason && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">退货原因</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                      {returnOrder.reason}
                    </div>
                  </div>
                </>
              )}

              {returnOrder.remarks && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">备注</Label>
                    <div className="mt-1 p-3 bg-muted/50 rounded-md text-sm">
                      {returnOrder.remarks}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 退货明细 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                退货明细
              </CardTitle>
              <CardDescription>
                共 {items.length} 个明细项目
              </CardDescription>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">暂无退货明细</p>
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
                          <TableHead>退货数量</TableHead>
                          <TableHead>单价</TableHead>
                          <TableHead>小计</TableHead>
                          <TableHead>商品状态</TableHead>
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
                                {item.returnQuantity} / {item.originalQuantity}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {formatReturnAmount(item.unitPrice)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {formatReturnAmount(item.subtotal)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                item.condition === 'good' ? 'default' : 
                                item.condition === 'damaged' ? 'destructive' : 'secondary'
                              }>
                                {item.condition === 'good' ? '完好' : 
                                 item.condition === 'damaged' ? '损坏' : '缺陷'}
                              </Badge>
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
                                {formatReturnAmount(item.subtotal)}
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
                              <span className="text-muted-foreground">退货数量:</span>
                              <span>{item.returnQuantity} / {item.originalQuantity}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">单价:</span>
                              <span>{formatReturnAmount(item.unitPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">商品状态:</span>
                              <Badge variant={
                                item.condition === 'good' ? 'default' : 
                                item.condition === 'damaged' ? 'destructive' : 'secondary'
                              }>
                                {item.condition === 'good' ? '完好' : 
                                 item.condition === 'damaged' ? '损坏' : '缺陷'}
                              </Badge>
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
                        {formatReturnAmount(returnOrder.totalAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground">退货总金额</div>
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
              {returnOrder.status === 'draft' && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('submitted')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  提交审核
                </Button>
              )}
              
              {canApproveReturnOrder(returnOrder) && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={handleApproval}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  审核订单
                </Button>
              )}
              
              {canProcessReturnOrder(returnOrder) && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('processing')}
                >
                  <Package className="h-4 w-4 mr-2" />
                  开始处理
                </Button>
              )}
              
              {canCompleteReturnOrder(returnOrder) && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('completed')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  完成退货
                </Button>
              )}
              
              {canCancelReturnOrder(returnOrder) && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => handleStatusUpdate('cancelled')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  取消订单
                </Button>
              )}
              
              {returnOrder.status === 'draft' && (
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
                <span>{formatReturnDate(returnOrder.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新时间:</span>
                <span>{formatReturnDate(returnOrder.updatedAt)}</span>
              </div>
              {returnOrder.submittedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">提交时间:</span>
                  <span>{formatReturnDate(returnOrder.submittedAt)}</span>
                </div>
              )}
              {returnOrder.approvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">审核时间:</span>
                  <span>{formatReturnDate(returnOrder.approvedAt)}</span>
                </div>
              )}
              {returnOrder.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">完成时间:</span>
                  <span>{formatReturnDate(returnOrder.completedAt)}</span>
                </div>
              )}
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
              将订单状态更新为：{RETURN_ORDER_STATUS_LABELS[newStatus as keyof typeof RETURN_ORDER_STATUS_LABELS]}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {(newStatus === 'completed') && (
              <div>
                <Label htmlFor="refundAmount">退款金额 *</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
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

      {/* 审核对话框 */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核退货订单</DialogTitle>
            <DialogDescription>
              请选择审核结果并填写相关信息
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="approvalDecision">审核结果 *</Label>
              <Select 
                value={approvalDecision ? 'approved' : 'rejected'} 
                onValueChange={(value) => setApprovalDecision(value === 'approved')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">审核通过</SelectItem>
                  <SelectItem value="rejected">审核拒绝</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {approvalDecision && (
              <div>
                <Label htmlFor="refundAmount">退款金额 *</Label>
                <Input
                  id="refundAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>
            )}
            
            <div>
              <Label htmlFor="statusRemarks">审核备注</Label>
              <Textarea
                id="statusRemarks"
                placeholder="审核备注..."
                value={statusRemarks}
                onChange={(e) => setStatusRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApprovalDialog(false)}>
              取消
            </Button>
            <Button 
              onClick={confirmApproval}
              disabled={approvalMutation.isPending}
            >
              确认审核
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
              确定要删除退货订单 {returnOrder.returnNumber} 吗？此操作不可撤销。
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
function ReturnOrderDetailPageSkeleton() {
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
                {Array.from({ length: 8 }).map((_, i) => (
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
              {Array.from({ length: 6 }).map((_, i) => (
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

// 收款记录列表页面
// 收款管理模块的主页面，展示收款记录列表

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { 
  Plus, 
  DollarSign, 
  AlertCircle,
  FileText,
  TrendingUp
} from 'lucide-react'

import { PaymentList } from '@/components/payments/payment-list'
import { 
  usePaymentRecords, 
  useDeletePaymentRecord, 
  useConfirmPayment, 
  useCancelPayment 
} from '@/lib/api/payments'
import type { 
  PaymentRecordDetail, 
  PaymentRecordQuery 
} from '@/lib/types/payment'

export default function PaymentsPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // 查询状态
  const [query, setQuery] = React.useState<PaymentRecordQuery>({
    page: 1,
    pageSize: 10,
    sortBy: 'paymentDate',
    sortOrder: 'desc'
  })

  // 数据查询
  const { 
    data: paymentsData, 
    isLoading, 
    error, 
    refetch 
  } = usePaymentRecords(query)

  // 操作mutations
  const deletePaymentMutation = useDeletePaymentRecord()
  const confirmPaymentMutation = useConfirmPayment()
  const cancelPaymentMutation = useCancelPayment()

  // 处理查询变化
  const handleQueryChange = (newQuery: Partial<PaymentRecordQuery>) => {
    setQuery(prev => ({ ...prev, ...newQuery }))
  }

  // 处理查看详情
  const handleView = (payment: PaymentRecordDetail) => {
    router.push(`/payments/${payment.id}`)
  }

  // 处理编辑
  const handleEdit = (payment: PaymentRecordDetail) => {
    router.push(`/payments/${payment.id}/edit`)
  }

  // 处理删除
  const handleDelete = async (payment: PaymentRecordDetail) => {
    if (!confirm(`确定要删除收款记录 ${payment.paymentNumber} 吗？`)) {
      return
    }

    try {
      await deletePaymentMutation.mutateAsync(payment.id)
      toast({
        title: '删除成功',
        description: `收款记录 ${payment.paymentNumber} 已删除`,
      })
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除收款记录时发生错误',
        variant: 'destructive',
      })
    }
  }

  // 处理确认收款
  const handleConfirm = async (payment: PaymentRecordDetail) => {
    if (!confirm(`确定要确认收款记录 ${payment.paymentNumber} 吗？`)) {
      return
    }

    try {
      await confirmPaymentMutation.mutateAsync({ 
        id: payment.id, 
        notes: '手动确认收款' 
      })
      toast({
        title: '确认成功',
        description: `收款记录 ${payment.paymentNumber} 已确认`,
      })
    } catch (error) {
      toast({
        title: '确认失败',
        description: error instanceof Error ? error.message : '确认收款时发生错误',
        variant: 'destructive',
      })
    }
  }

  // 处理取消收款
  const handleCancel = async (payment: PaymentRecordDetail) => {
    if (!confirm(`确定要取消收款记录 ${payment.paymentNumber} 吗？`)) {
      return
    }

    try {
      await cancelPaymentMutation.mutateAsync({ 
        id: payment.id, 
        notes: '手动取消收款' 
      })
      toast({
        title: '取消成功',
        description: `收款记录 ${payment.paymentNumber} 已取消`,
      })
    } catch (error) {
      toast({
        title: '取消失败',
        description: error instanceof Error ? error.message : '取消收款时发生错误',
        variant: 'destructive',
      })
    }
  }

  // 处理创建收款记录
  const handleCreate = () => {
    router.push('/payments/create')
  }

  // 处理刷新
  const handleRefresh = () => {
    refetch()
  }

  // 错误处理
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            加载收款记录失败: {error instanceof Error ? error.message : '未知错误'}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
            <DollarSign className="h-8 w-8" />
            <span>收款管理</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            管理销售订单的收款记录，跟踪收款状态和进度
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => router.push('/payments/accounts-receivable')}>
            <FileText className="h-4 w-4 mr-2" />
            应收账款
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            创建收款记录
          </Button>
        </div>
      </div>

      {/* 快速统计 */}
      {paymentsData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">总收款记录</p>
                  <p className="text-2xl font-bold">{paymentsData.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">待确认收款</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {paymentsData.payments.filter(p => p.status === 'pending').length}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">已确认收款</p>
                  <p className="text-2xl font-bold text-green-600">
                    {paymentsData.payments.filter(p => p.status === 'confirmed').length}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 收款记录列表 */}
      <PaymentList
        payments={paymentsData?.payments || []}
        total={paymentsData?.total || 0}
        page={query.page || 1}
        pageSize={query.pageSize || 10}
        query={query}
        loading={isLoading}
        onQueryChange={handleQueryChange}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        onRefresh={handleRefresh}
      />
    </div>
  )
}

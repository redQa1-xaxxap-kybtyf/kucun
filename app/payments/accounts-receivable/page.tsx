// 应收账款查询页面
// 展示应收账款统计和详细列表

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  DollarSign, 
  AlertCircle,
  Plus,
  FileText,
  TrendingUp,
  Download
} from 'lucide-react'

import { AccountsReceivableComponent } from '@/components/payments/accounts-receivable'
import { 
  useAccountsReceivable, 
  usePaymentStatistics 
} from '@/lib/api/payments'
import type { 
  AccountsReceivable, 
  AccountsReceivableQuery 
} from '@/lib/types/payment'

export default function AccountsReceivablePage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // 查询状态
  const [query, setQuery] = React.useState<AccountsReceivableQuery>({
    page: 1,
    pageSize: 10,
    sortBy: 'orderDate',
    sortOrder: 'desc'
  })

  // 数据查询
  const { 
    data: receivablesData, 
    isLoading: receivablesLoading, 
    error: receivablesError, 
    refetch: refetchReceivables 
  } = useAccountsReceivable(query)

  // 统计数据查询
  const { 
    data: statisticsData, 
    isLoading: statisticsLoading, 
    error: statisticsError 
  } = usePaymentStatistics()

  // 处理查询变化
  const handleQueryChange = (newQuery: Partial<AccountsReceivableQuery>) => {
    setQuery(prev => ({ ...prev, ...newQuery }))
  }

  // 处理查看详情
  const handleView = (receivable: AccountsReceivable) => {
    router.push(`/sales-orders/${receivable.salesOrderId}`)
  }

  // 处理创建收款记录
  const handleCreatePayment = (receivable: AccountsReceivable) => {
    router.push(`/payments/create?salesOrderId=${receivable.salesOrderId}&customerId=${receivable.customerId}`)
  }

  // 处理刷新
  const handleRefresh = () => {
    refetchReceivables()
  }

  // 处理导出
  const handleExport = () => {
    toast({
      title: '导出功能',
      description: '导出功能正在开发中...',
    })
  }

  // 错误处理
  if (receivablesError || statisticsError) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            加载应收账款数据失败: {
              (receivablesError || statisticsError) instanceof Error 
                ? (receivablesError || statisticsError)?.message 
                : '未知错误'
            }
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 默认统计数据
  const defaultStatistics = {
    totalReceivable: 0,
    totalReceived: 0,
    totalPending: 0,
    paymentRate: 0,
    overdueAmount: 0,
    overdueCount: 0,
    monthlyTrend: [],
    customerStatistics: [],
    methodStatistics: []
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/payments')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回收款管理
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center space-x-2">
              <FileText className="h-8 w-8" />
              <span>应收账款</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              查看和管理客户的应收账款情况
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出报表
          </Button>
          <Button onClick={() => router.push('/payments/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建收款记录
          </Button>
        </div>
      </div>

      {/* 应收账款组件 */}
      <AccountsReceivableComponent
        receivables={receivablesData?.receivables || []}
        statistics={statisticsData || defaultStatistics}
        total={receivablesData?.total || 0}
        page={query.page || 1}
        pageSize={query.pageSize || 10}
        query={query}
        loading={receivablesLoading || statisticsLoading}
        onQueryChange={handleQueryChange}
        onView={handleView}
        onCreatePayment={handleCreatePayment}
        onRefresh={handleRefresh}
      />
    </div>
  )
}

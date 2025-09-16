'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

// UI Components
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Icons
import { ArrowLeft, AlertCircle } from 'lucide-react'

// Components
import { SalesOrderForm } from '@/components/sales-orders/sales-order-form'

// API and Types
import { getSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders'
import { SalesOrder } from '@/lib/types/sales-order'

interface EditSalesOrderPageProps {
  params: {
    id: string
  }
}

export default function EditSalesOrderPage({ params }: EditSalesOrderPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = params

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

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 编辑成功后的处理
  const handleSuccess = (salesOrder: SalesOrder) => {
    router.push(`/sales-orders/${salesOrder.id}`)
  }

  // 取消操作
  const handleCancel = () => {
    router.push(`/sales-orders/${id}`)
  }

  if (status === 'loading' || isLoading) {
    return <EditSalesOrderPageSkeleton />
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
              <h1 className="text-3xl font-bold tracking-tight">编辑销售订单</h1>
              <p className="text-muted-foreground">修改销售订单信息和明细</p>
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
              <h1 className="text-3xl font-bold tracking-tight">编辑销售订单</h1>
              <p className="text-muted-foreground">修改销售订单信息和明细</p>
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

  // 检查订单是否可以编辑
  const canEdit = ['draft', 'confirmed'].includes(salesOrder.status)

  if (!canEdit) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/sales-orders')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">编辑销售订单</h1>
              <p className="text-muted-foreground">修改销售订单信息和明细</p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              当前订单状态为"{salesOrder.status}"，不允许编辑。只有草稿和已确认状态的订单可以编辑。
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={() => router.push(`/sales-orders/${id}`)}>
              查看订单详情
            </Button>
            <Button variant="outline" onClick={() => router.push('/sales-orders')}>
              返回列表
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <SalesOrderForm
      mode="edit"
      initialData={salesOrder}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  )
}

// 加载骨架屏
function EditSalesOrderPageSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

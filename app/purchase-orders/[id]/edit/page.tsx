'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

// Components
import { PurchaseOrderForm } from '@/components/purchase-orders/purchase-order-form'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Icons
import { AlertCircle } from 'lucide-react'

// API and Types
import { getPurchaseOrder, purchaseOrderQueryKeys } from '@/lib/api/purchase-orders'
import { PurchaseOrder } from '@/lib/types/purchase-order'

interface EditPurchaseOrderPageProps {
  params: {
    id: string
  }
}

export default function EditPurchaseOrderPage({ params }: EditPurchaseOrderPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

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

  // 编辑成功后的处理
  const handleSuccess = (result: PurchaseOrder) => {
    router.push(`/purchase-orders/${result.id}`)
  }

  // 取消操作
  const handleCancel = () => {
    router.push(`/purchase-orders/${params.id}`)
  }

  if (status === 'loading' || isLoading) {
    return <EditPurchaseOrderPageSkeleton />
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

  // 检查是否可以编辑
  if (purchaseOrder.status !== 'draft' && purchaseOrder.status !== 'confirmed') {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            当前状态的采购订单不允许编辑
          </AlertDescription>
        </Alert>
        <div className="mt-4 space-x-2">
          <Button onClick={() => router.push(`/purchase-orders/${params.id}`)}>
            查看详情
          </Button>
          <Button variant="outline" onClick={() => router.push('/purchase-orders')}>
            返回列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <PurchaseOrderForm
      mode="edit"
      initialData={purchaseOrder}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  )
}

// 加载骨架屏
function EditPurchaseOrderPageSkeleton() {
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
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  )
}

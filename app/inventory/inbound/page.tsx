'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

// Components
import { InventoryOperationForm } from '@/components/inventory/inventory-operation-form'
import { Skeleton } from '@/components/ui/skeleton'

// Types
import { InboundRecord } from '@/lib/types/inventory'

export default function InboundPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  // 入库成功后的处理
  const handleSuccess = (result: InboundRecord) => {
    router.push('/inventory')
  }

  // 取消操作
  const handleCancel = () => {
    router.push('/inventory')
  }

  if (status === 'loading') {
    return <InboundPageSkeleton />
  }

  if (!session) {
    return null
  }

  return (
    <InventoryOperationForm
      mode="inbound"
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  )
}

// 加载骨架屏
function InboundPageSkeleton() {
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

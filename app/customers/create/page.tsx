'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomerForm } from '@/components/customers/customer-form'

export default function CreateCustomerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <CustomerForm
      mode="create"
      onSuccess={(customer) => {
        router.push('/customers')
      }}
      onCancel={() => {
        router.push('/customers')
      }}
    />
  )
}

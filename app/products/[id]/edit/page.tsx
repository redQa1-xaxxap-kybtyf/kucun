'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { ProductForm } from '@/components/products/product-form'
import { getProduct, productQueryKeys } from '@/lib/api/products'

interface EditProductPageProps {
  params: {
    id: string
  }
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = params

  // 获取产品详情
  const {
    data: productData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: () => getProduct(id),
    enabled: !!session?.user?.id && !!id,
  })

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

  if (isLoading) {
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
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/products')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">编辑产品</h1>
              <p className="text-muted-foreground">修改产品信息和规格参数</p>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : '获取产品信息失败'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={() => refetch()}>
              重试
            </Button>
            <Button variant="outline" onClick={() => router.push('/products')}>
              返回产品列表
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!productData?.data) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/products')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">编辑产品</h1>
              <p className="text-muted-foreground">修改产品信息和规格参数</p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              未找到指定的产品信息
            </AlertDescription>
          </Alert>

          <Button variant="outline" onClick={() => router.push('/products')}>
            返回产品列表
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ProductForm
      mode="edit"
      initialData={productData.data}
      onSuccess={(product) => {
        router.push('/products')
      }}
      onCancel={() => {
        router.push('/products')
      }}
    />
  )
}

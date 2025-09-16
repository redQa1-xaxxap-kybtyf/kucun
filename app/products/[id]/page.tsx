'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Package, Palette, Ruler, AlertCircle, Image as ImageIcon } from 'lucide-react'
import { getProduct, productQueryKeys } from '@/lib/api/products'
import { PRODUCT_UNIT_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_STATUS_VARIANTS } from '@/lib/types/product'

interface ProductDetailPageProps {
  params: {
    id: string
  }
}

export default function ProductDetailPage({ params }: ProductDetailPageProps) {
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

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
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
              <h1 className="text-3xl font-bold tracking-tight">产品详情</h1>
              <p className="text-muted-foreground">查看产品的详细信息</p>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : '获取产品信息失败'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={() => refetch()}>重试</Button>
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
              <h1 className="text-3xl font-bold tracking-tight">产品详情</h1>
              <p className="text-muted-foreground">查看产品的详细信息</p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>未找到指定的产品信息</AlertDescription>
          </Alert>

          <Button variant="outline" onClick={() => router.push('/products')}>
            返回产品列表
          </Button>
        </div>
      </div>
    )
  }

  const product = productData.data

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/products')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-muted-foreground">产品编码：{product.code}</p>
          </div>
        </div>
        <Button onClick={() => router.push(`/products/${product.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑产品
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                基础信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">产品编码</label>
                  <p className="font-mono">{product.code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">产品名称</label>
                  <p className="font-medium">{product.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">计量单位</label>
                  <Badge variant="outline">{PRODUCT_UNIT_LABELS[product.unit]}</Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">每件片数</label>
                  <p>{product.piecesPerUnit} 片</p>
                </div>
                {product.weight && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">重量</label>
                    <p>{product.weight} kg</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">状态</label>
                  <Badge variant={PRODUCT_STATUS_VARIANTS[product.status]}>
                    {PRODUCT_STATUS_LABELS[product.status]}
                  </Badge>
                </div>
              </div>

              {product.specification && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">规格描述</label>
                    <p className="mt-1 text-sm leading-relaxed">{product.specification}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 瓷砖规格信息 */}
          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="h-5 w-5 mr-2" />
                  瓷砖规格
                </CardTitle>
                <CardDescription>详细的瓷砖技术参数和特性</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(product.specifications).map(([key, value]) => {
                    if (!value) return null
                    
                    const labels: Record<string, string> = {
                      color: '颜色',
                      surface: '表面处理',
                      size: '尺寸规格',
                      thickness: '厚度',
                      pattern: '花纹',
                      grade: '等级',
                      origin: '产地',
                      series: '系列'
                    }

                    return (
                      <div key={key}>
                        <label className="text-sm font-medium text-muted-foreground">
                          {labels[key] || key}
                        </label>
                        <p className="font-medium">
                          {key === 'thickness' ? `${value}mm` : String(value)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 产品状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">产品状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">当前状态</span>
                <Badge variant={PRODUCT_STATUS_VARIANTS[product.status]}>
                  {PRODUCT_STATUS_LABELS[product.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">创建时间</span>
                <span className="text-sm">
                  {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">更新时间</span>
                <span className="text-sm">
                  {new Date(product.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 库存信息 */}
          {(product.totalInventory !== undefined || product.availableInventory !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">库存信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {product.totalInventory !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">总库存</span>
                    <span className="font-medium">{product.totalInventory}</span>
                  </div>
                )}
                {product.reservedInventory !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">预留库存</span>
                    <span className="font-medium">{product.reservedInventory}</span>
                  </div>
                )}
                {product.availableInventory !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">可用库存</span>
                    <span className="font-medium text-green-600">{product.availableInventory}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 产品图片 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <ImageIcon className="h-4 w-4 mr-2" />
                产品图片
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">暂无产品图片</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

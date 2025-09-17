'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowLeft,
    Edit,
    Info,
    Package,
    Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

// UI Components
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// API and Types
import { getProduct, productQueryKeys } from '@/lib/api/products';
import {
    PRODUCT_STATUS_LABELS,
    PRODUCT_UNIT_LABELS,
} from '@/lib/types/product';

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 产品详情页面
 * 严格遵循全栈项目统一约定规范
 */
export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  // 获取产品详情数据
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: () => getProduct(id),
  });

  // 状态标签渲染
  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant}>
        {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
          status}
      </Badge>
    );
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">产品详情</h1>
            <p className="text-muted-foreground">查看产品的详细信息</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              加载失败: {error instanceof Error ? error.message : '未知错误'}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">产品详情</h1>
            <p className="text-muted-foreground">查看产品的详细信息</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              产品不存在或已被删除
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
            <p className="text-muted-foreground">产品编码: {product.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/products/${id}/edit`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            编辑
          </Button>
          <Button variant="outline" className="text-red-600 hover:text-red-700">
            <Trash2 className="mr-2 h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {/* 产品信息 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              基本信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  产品编码
                </div>
                <div className="mt-1">{product.code}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  产品名称
                </div>
                <div className="mt-1">{product.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  规格
                </div>
                <div className="mt-1">{product.specification || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  计量单位
                </div>
                <div className="mt-1">
                  {PRODUCT_UNIT_LABELS[
                    product.unit as keyof typeof PRODUCT_UNIT_LABELS
                  ] || product.unit}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  每单位片数
                </div>
                <div className="mt-1">{product.piecesPerUnit || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  重量(kg)
                </div>
                <div className="mt-1">{product.weight || '-'}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  状态
                </div>
                <div className="mt-1">{getStatusBadge(product.status)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  创建时间
                </div>
                <div className="mt-1">
                  {new Date(product.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 规格信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              规格信息
            </CardTitle>
          </CardHeader>
          <CardContent>
            {product.specifications ? (
              <div className="space-y-2">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      {key}:
                    </span>
                    <span className="text-sm">{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                暂无规格信息
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 详细信息标签页 */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="inventory" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="inventory">库存信息</TabsTrigger>
              <TabsTrigger value="sales">销售记录</TabsTrigger>
              <TabsTrigger value="history">操作历史</TabsTrigger>
            </TabsList>
            <TabsContent value="inventory" className="mt-6">
              <div className="py-8 text-center text-muted-foreground">
                库存信息功能开发中...
              </div>
            </TabsContent>
            <TabsContent value="sales" className="mt-6">
              <div className="py-8 text-center text-muted-foreground">
                销售记录功能开发中...
              </div>
            </TabsContent>
            <TabsContent value="history" className="mt-6">
              <div className="py-8 text-center text-muted-foreground">
                操作历史功能开发中...
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

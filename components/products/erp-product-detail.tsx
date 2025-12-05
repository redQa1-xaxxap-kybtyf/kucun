'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ProductImageGallery } from '@/components/products/product-image-gallery';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { deleteProduct, productQueryKeys } from '@/lib/api/products';
import { PRODUCT_STATUS_LABELS, type Product } from '@/lib/types/product';
import { getCommonStatusBadgeVariant } from '@/lib/utils/badge-helpers';
import { formatDateTime } from '@/lib/utils/datetime';

interface ERPProductDetailProps {
  product: Product;
}

/**
 * 格式化规格字段显示
 * 如果是 JSON 字符串，解析并格式化显示；否则直接显示
 */
function formatSpecification(specification: string | null | undefined): string {
  if (!specification) {
    return '-';
  }

  // 尝试解析 JSON
  try {
    const parsed = JSON.parse(specification);
    if (typeof parsed === 'object' && parsed !== null) {
      // 格式化为键值对形式
      return Object.entries(parsed)
        .map(([key, value]) => {
          // 处理数组类型的值
          if (Array.isArray(value)) {
            return `${key}: ${value.join(', ')}`;
          }
          // 处理对象类型的值
          if (typeof value === 'object' && value !== null) {
            return `${key}: ${JSON.stringify(value)}`;
          }
          return `${key}: ${value}`;
        })
        .join(' | ');
    }
  } catch {
    // 不是 JSON，直接返回原字符串
  }

  return specification;
}

/**
 * ERP风格产品详情组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductDetail({ product }: ERPProductDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // 删除产品 Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: async () => {
      toast({
        title: '删除成功',
        description: `产品编码 "${product.code}" 已删除`,
        variant: 'success',
      });

      // ✅ 使用精确的缓存失效策略，避免刷新所有产品查询
      // 1. 失效产品列表查询（触发重新获取）
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.lists(),
      });

      // 2. 移除已删除产品的详情查询
      queryClient.removeQueries({
        queryKey: productQueryKeys.detail(product.id),
      });

      // 跳转回产品列表
      router.push('/products');
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error?.message || '删除产品失败，请重试',
        variant: 'destructive',
      });
    },
  });

  // 状态标签渲染
  const getStatusBadge = (status: string) => (
    <Badge variant={getCommonStatusBadgeVariant(status)} className="text-xs">
      {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
        status}
    </Badge>
  );

  // 删除确认处理
  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const confirmDelete = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-auto p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
          <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
                  <Edit className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                    {product.name}
                  </h1>
                  <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                    编码: {product.code}
                  </p>
                </div>
                {getStatusBadge(product.status)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="h-11 gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Button>
                <Button
                  variant="default"
                  size="lg"
                  onClick={() => router.push(`/products/${product.id}/edit`)}
                  className="card-shadow-light h-11 gap-2 transition-transform duration-150 hover:scale-[1.02]"
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="h-11 gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 基本信息区域 */}
        <div className="card-shadow-medium overflow-hidden rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-card))]">
          <div className="border-b border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-bg-secondary))] px-6 py-4">
            <h4 className="font-semibold text-[hsl(var(--color-text-primary))]">
              基本信息
            </h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  产品编码
                </div>
                <div className="mt-2 font-medium text-[hsl(var(--color-primary))]">
                  {product.code}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  产品名称
                </div>
                <div className="mt-2 font-medium text-[hsl(var(--color-text-primary))]">
                  {product.name}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  规格
                </div>
                <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {formatSpecification(product.specification)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  每单位片数
                </div>
                <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {product.piecesPerUnit || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  重量 (kg)
                </div>
                <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {product.weight || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  厚度 (mm)
                </div>
                <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {product.thickness || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-[hsl(var(--color-text-tertiary))]">
                  产品分类
                </div>
                <div className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
                  {product.category ? product.category.name : '未分类'}
                </div>
              </div>
            </div>

            {/* 系统信息 - 紧凑显示 */}
            <div className="mt-6 border-t border-[hsl(var(--color-border-primary))] pt-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[hsl(var(--color-text-secondary))]">
                <div className="flex items-center gap-2">
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    状态:
                  </span>
                  {getStatusBadge(product.status)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    创建时间:
                  </span>
                  <span>{formatDateTime(product.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[hsl(var(--color-text-tertiary))]">
                    更新时间:
                  </span>
                  <span>{formatDateTime(product.updatedAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 产品图片展示区域 */}
        <ProductImageGallery
          thumbnailUrl={product.thumbnailUrl}
          images={product.images}
          productName={product.name}
        />

        {/* 删除确认对话框 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除产品</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除产品编码 &quot;{product.code}&quot; 吗？
                <br />
                <span className="font-medium text-[hsl(var(--color-error))]">
                  此操作不可撤销，删除后将无法恢复产品数据。
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>
                取消
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-[hsl(var(--color-error))] text-[hsl(var(--color-text-on-primary))] hover:bg-[hsl(var(--color-error-hover))]"
              >
                {deleteMutation.isPending ? '删除中...' : '确认删除'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { deleteProduct, productQueryKeys } from '@/lib/api/products';
import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
  type Product,
} from '@/lib/types/product';

interface ERPProductDetailProps {
  product: Product;
}

/**
 * ERP风格产品详情组件
 * 符合中国ERP系统的界面标准和用户习惯
 */
export function ERPProductDetail({ product }: ERPProductDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 删除产品 Mutation
  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(product.id),
    onSuccess: () => {
      toast({
        title: '删除成功',
        description: `产品 "${product.name}" 已删除`,
        variant: 'success',
      });

      // 失效相关查询缓存
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });

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
  const getStatusBadge = (status: string) => {
    const variant = status === 'active' ? 'default' : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ||
          status}
      </Badge>
    );
  };

  // 删除确认处理
  const handleDelete = () => {
    // 待办：使用更好的确认对话框组件替代window.confirm
    // eslint-disable-next-line no-alert
    if (
      window.confirm(`确定要删除产品 "${product.name}" 吗？此操作不可撤销。`)
    ) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      {/* ERP标准工具栏 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">产品详情</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => router.back()}
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                返回
              </Button>
            </div>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <div className="text-sm font-medium">{product.name}</div>
                <div className="text-xs text-muted-foreground">
                  编码: {product.code}
                </div>
              </div>
              {getStatusBadge(product.status)}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => router.push(`/products/${product.id}/edit`)}
              >
                <Edit className="mr-1 h-3 w-3" />
                编辑
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-red-600 hover:text-red-700"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="mr-1 h-3 w-3" />
                删除
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 基本信息区域 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h4 className="text-sm font-medium">基本信息</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                产品编码
              </div>
              <div className="mt-1 text-sm">{product.code}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                产品名称
              </div>
              <div className="mt-1 text-sm">{product.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                规格
              </div>
              <div className="mt-1 text-sm">{product.specification || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                计量单位
              </div>
              <div className="mt-1 text-sm">
                {PRODUCT_UNIT_LABELS[
                  product.unit as keyof typeof PRODUCT_UNIT_LABELS
                ] || product.unit}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                每单位片数
              </div>
              <div className="mt-1 text-sm">{product.piecesPerUnit || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                重量 (kg)
              </div>
              <div className="mt-1 text-sm">{product.weight || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                厚度 (mm)
              </div>
              <div className="mt-1 text-sm">{product.thickness || '-'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                产品分类
              </div>
              <div className="mt-1 text-sm">
                {product.category ? product.category.name : '未分类'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 系统信息区域 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h4 className="text-sm font-medium">系统信息</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                产品状态
              </div>
              <div className="mt-1">{getStatusBadge(product.status)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                创建时间
              </div>
              <div className="mt-1 text-sm">
                {new Date(product.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                更新时间
              </div>
              <div className="mt-1 text-sm">
                {new Date(product.updatedAt).toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 扩展信息区域 - 预留给未来功能 */}
      <div className="rounded border bg-card">
        <div className="border-b bg-muted/30 px-3 py-2">
          <h4 className="text-sm font-medium">扩展信息</h4>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded border border-dashed border-muted-foreground/25 p-4 text-center">
              <div className="text-xs text-muted-foreground">库存信息</div>
              <div className="mt-1 text-sm text-muted-foreground">
                功能开发中
              </div>
            </div>
            <div className="rounded border border-dashed border-muted-foreground/25 p-4 text-center">
              <div className="text-xs text-muted-foreground">销售记录</div>
              <div className="mt-1 text-sm text-muted-foreground">
                功能开发中
              </div>
            </div>
            <div className="rounded border border-dashed border-muted-foreground/25 p-4 text-center">
              <div className="text-xs text-muted-foreground">操作历史</div>
              <div className="mt-1 text-sm text-muted-foreground">
                功能开发中
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

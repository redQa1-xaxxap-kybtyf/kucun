'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

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

      // 等待缓存失效并重新获取完成，确保列表数据会被重新获取
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'active', // 立即重新获取所有活跃的查询
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
    setDeleteDialogOpen(true);
  };

  // 确认删除
  const confirmDelete = () => {
    deleteMutation.mutate();
    setDeleteDialogOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="space-y-6">
        {/* 页面标题卡片 */}
        <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
          <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
                  <Edit className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                    {product.name}
                  </h1>
                  <p className="text-sm text-gray-600">编码: {product.code}</p>
                </div>
                {getStatusBadge(product.status)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.back()}
                  className="h-11 gap-2 transition-all hover:scale-105 hover:border-gray-400"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => router.push(`/products/${product.id}/edit`)}
                  className="h-11 gap-2 bg-blue-600 text-white shadow-md shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/40"
                >
                  <Edit className="h-4 w-4" />
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="h-11 gap-2 border-red-200 text-red-600 transition-all hover:scale-105 hover:border-red-300 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 基本信息区域 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
          <div className="border-b bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4">
            <h4 className="font-semibold text-gray-900">基本信息</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-gray-500">
                  产品编码
                </div>
                <div className="mt-2 font-medium text-blue-600">
                  {product.code}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  产品名称
                </div>
                <div className="mt-2 font-medium text-gray-900">
                  {product.name}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">规格</div>
                <div className="mt-2 text-sm text-gray-700">
                  {formatSpecification(product.specification)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  每单位片数
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {product.piecesPerUnit || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  重量 (kg)
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {product.weight || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  厚度 (mm)
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {product.thickness || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  产品分类
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {product.category ? product.category.name : '未分类'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 系统信息区域 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
          <div className="border-b bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4">
            <h4 className="font-semibold text-gray-900">系统信息</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <div className="text-xs font-medium text-gray-500">
                  产品状态
                </div>
                <div className="mt-2">{getStatusBadge(product.status)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  创建时间
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {new Date(product.createdAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-500">
                  更新时间
                </div>
                <div className="mt-2 text-sm text-gray-700">
                  {new Date(product.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 扩展信息区域 - 预留给未来功能 */}
        <div className="overflow-hidden rounded-lg border bg-white shadow-lg shadow-gray-200/50">
          <div className="border-b bg-gradient-to-r from-slate-50 to-gray-50 px-6 py-4">
            <h4 className="font-semibold text-gray-900">扩展信息</h4>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center transition-all hover:border-blue-300 hover:bg-blue-50/50">
                <div className="text-xs font-medium text-gray-500">
                  库存信息
                </div>
                <div className="mt-2 text-sm text-gray-600">功能开发中</div>
              </div>
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center transition-all hover:border-blue-300 hover:bg-blue-50/50">
                <div className="text-xs font-medium text-gray-500">
                  销售记录
                </div>
                <div className="mt-2 text-sm text-gray-600">功能开发中</div>
              </div>
              <div className="border-muted-foreground/25 rounded border border-dashed p-4 text-center">
                <div className="text-muted-foreground text-xs">操作历史</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  功能开发中
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 删除确认对话框 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除产品</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除产品编码 &quot;{product.code}&quot; 吗？
                <br />
                <span className="font-medium text-red-600">
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
                className="bg-red-600 hover:bg-red-700"
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

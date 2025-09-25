'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { ProductForm } from '@/components/products/product-form';
import { Button } from '@/components/ui/button';
import { getProduct, productQueryKeys } from '@/lib/api/products';

/**
 * 产品编辑页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */

interface ProductEditPageProps {
  params: Promise<{ id: string }>;
}

export default function ProductEditPage({ params }: ProductEditPageProps) {
  const router = useRouter();

  // 解析动态路由参数 (Next.js 15.4 要求)
  const { id: productId } = React.use(params);

  // 获取产品数据
  const {
    data: product,
    isLoading: isProductLoading,
    error: productError,
  } = useQuery({
    queryKey: productQueryKeys.detail(productId),
    queryFn: () => getProduct(productId),
    // 确保每次进入编辑页面都获取最新数据
    staleTime: 0,
    gcTime: 0,
  });

  // 加载状态
  if (isProductLoading) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>正在加载产品信息...</span>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (productError) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-600">
              加载产品信息失败
            </h2>
            <p className="mb-4 text-gray-600">
              {productError?.message || '请检查网络连接后重试'}
            </p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-gray-600">
              产品不存在
            </h2>
            <p className="mb-4 text-gray-500">请检查产品ID是否正确</p>
            <Button onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
      <ProductForm
        mode="edit"
        productId={productId}
        initialData={product}
        variant="erp"
      />
    </div>
  );
}

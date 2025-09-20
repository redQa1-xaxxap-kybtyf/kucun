'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

// UI Components
import { ERPProductDetail } from '@/components/products/erp-product-detail';
import { Button } from '@/components/ui/button';
// API and Types
import { getProduct, productQueryKeys } from '@/lib/api/products';

interface ProductDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * 产品详情页面 - ERP风格
 * 符合中国ERP系统的界面标准和用户习惯
 */
export default function ProductDetailPage({ params }: ProductDetailPageProps) {
  const router = useRouter();
  const { id } = use(params);

  // 获取产品详情数据
  const {
    data: product,
    isLoading,
    error,
  } = useQuery({
    queryKey: productQueryKeys.detail(id),
    queryFn: () => getProduct(id),
  });

  // 错误状态
  if (error) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-lg font-semibold text-red-600">
              加载产品信息失败
            </h2>
            <p className="mb-4 text-gray-600">
              {error instanceof Error ? error.message : '请检查网络连接后重试'}
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

  // 加载状态
  if (isLoading) {
    return (
      <div className="mx-auto max-w-none space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
            <span>正在加载产品信息...</span>
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

  return <ERPProductDetail product={product} />;
}

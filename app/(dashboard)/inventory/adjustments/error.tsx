'use client';

import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { reportErrorBoundary } from '@/lib/services/error-reporting-service';

/**
 * 库存调整记录错误边界
 * Next.js 15 最佳实践：使用 error.tsx 捕获并处理组件树错误
 * ✅ 统一使用 reportErrorBoundary 进行错误上报
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function AdjustmentRecordsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // 上报错误到监控服务
    reportErrorBoundary(error, 'AdjustmentRecordsError', {
      pageTitle: '库存调整记录',
      route: '/inventory/adjustments',
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <AlertCircle className="h-16 w-16 text-red-600" />
        </div>

        <h2 className="mb-2 text-2xl font-semibold text-gray-900">
          加载调整记录时出错
        </h2>

        <p className="mb-6 text-gray-600">
          {error.message || '发生了未知错误，请稍后重试'}
        </p>

        <div className="flex justify-center gap-3">
          <Button
            onClick={() => router.push('/inventory')}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回库存
          </Button>

          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && error.digest && (
          <p className="mt-4 text-xs text-gray-500">参考编号：{error.digest}</p>
        )}
      </div>
    </div>
  );
}


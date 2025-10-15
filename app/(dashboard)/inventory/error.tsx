'use client';

import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { logClientError } from '@/lib/logger/client';

/**
 * 库存模块错误边界
 * Next.js 15 最佳实践：使用 error.tsx 捕获并处理组件树错误
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
export default function InventoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logClientError('inventory', '库存模块错误', error, {
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <AlertCircle className="h-16 w-16 text-red-600" />
        </div>

        <h2 className="mb-2 text-2xl font-semibold text-gray-900">
          加载库存数据时出错
        </h2>

        <p className="mb-6 text-gray-600">
          {error.message || '发生了未知错误，请稍后重试'}
        </p>

        {error.digest && (
          <p className="mb-4 text-xs text-gray-500">错误 ID: {error.digest}</p>
        )}

        <div className="flex justify-center gap-3">
          <Button onClick={reset} variant="default" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重试
          </Button>

          <Button
            onClick={() => (window.location.href = '/inventory')}
            variant="outline"
          >
            刷新页面
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              开发者信息
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

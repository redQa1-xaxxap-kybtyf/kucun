'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 厂家发货模块错误边界
 *
 * ✅ Next.js 15 最佳实践：
 * - Client Component 错误边界
 * - 提供友好的错误提示
 * - 支持重试功能
 * - 开发模式显示错误堆栈
 */
export default function FactoryShipmentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到监控服务
    console.error('厂家发货模块错误:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              加载厂家发货数据时出错
            </h2>
            <p className="text-sm text-gray-600">
              无法加载厂家发货订单数据，请稍后重试
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="w-full rounded-lg bg-gray-100 p-4 text-left">
              <p className="mb-2 text-xs font-semibold text-gray-700">
                错误详情 (仅开发模式显示):
              </p>
              <pre className="overflow-auto text-xs text-red-600">
                {error.message}
              </pre>
              {error.digest && (
                <p className="mt-2 text-xs text-gray-600">
                  错误 ID: {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <Button onClick={reset} size="lg">
              重试
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="/dashboard">返回首页</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

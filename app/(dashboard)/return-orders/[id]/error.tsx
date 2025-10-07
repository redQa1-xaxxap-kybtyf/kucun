'use client';

import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 退货订单详情页面错误边界
 *
 * ✅ Next.js 15 最佳实践：错误边界组件
 */
export default function ReturnOrderDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('退货订单详情页面错误:', error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-12 w-12 text-red-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900">
              退货订单详情加载失败
            </h2>
            <p className="text-sm text-gray-600">
              无法加载退货订单详情，请稍后重试
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
              <Link href="/return-orders">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回退货订单列表
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

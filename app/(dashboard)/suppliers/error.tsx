'use client';

import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { logger } from '@/lib/utils/console-logger';

/**
 * 供应商管理主页面错误边界
 *
 * ✅ Next.js 15 最佳实践：错误边界组件
 */
export default function SuppliersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error(
      'dashboard:suppliers:error-boundary',
      '供应商管理页面错误',
      error,
      { digest: error.digest }
    );
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <Card className="border border-[hsl(var(--color-error))] bg-[hsl(var(--color-error-light))]">
        <CardContent className="flex flex-col items-center justify-center space-y-6 p-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(var(--color-error-light))]">
            <AlertCircle className="h-12 w-12 text-[hsl(var(--color-error))]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-[hsl(var(--color-text-primary))]">
              供应商管理加载失败
            </h2>
            <p className="text-sm text-[hsl(var(--color-text-secondary))]">
              无法加载供应商列表，请稍后重试
            </p>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="w-full rounded-lg bg-[hsl(var(--color-bg-tertiary))] p-4 text-left">
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--color-text-primary))]">
                错误详情 (仅开发模式显示):
              </p>
              <pre className="overflow-auto text-xs text-[hsl(var(--color-error))]">
                {error.message}
              </pre>
              {error.digest && (
                <p className="mt-2 text-xs text-[hsl(var(--color-text-secondary))]">
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
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

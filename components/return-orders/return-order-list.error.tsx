import { TrendingDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateCardProps {
  onRetry: () => void;
  error?: unknown;
}

export function ErrorStateCard({ onRetry, error }: ErrorStateCardProps) {
  const errorMessage = error instanceof Error ? error.message : '未知错误';

  return (
    <Card className="rounded-md border border-border shadow-sm">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center gap-4 py-8">
          <div className="text-center">
            <p className="text-lg font-semibold text-[hsl(var(--color-error))]">
              加载退货订单失败
            </p>
            <p className="mt-2 text-sm text-[hsl(var(--color-text-secondary))]">
              {errorMessage}
            </p>
          </div>
          <Button variant="outline" onClick={onRetry} className="mt-2">
            <TrendingDown className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

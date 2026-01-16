'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorStateCardProps {
  onRetry: () => void;
  label?: string;
}

export function ErrorStateCard({
  onRetry,
  label = '厂家发货订单',
}: ErrorStateCardProps) {
  return (
    <Card className="card-shadow-light overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardContent className="space-y-4 bg-[hsl(var(--color-error-light))] py-8 text-center">
        <div className="text-[hsl(var(--color-error))]">
          加载{label}失败，请稍后重试
        </div>
        <Button variant="outline" onClick={onRetry}>
          重新加载
        </Button>
      </CardContent>
    </Card>
  );
}

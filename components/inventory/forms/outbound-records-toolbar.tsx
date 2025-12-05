'use client';

import { ArrowLeft, PackageX } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function OutboundRecordsToolbar() {
  const router = useRouter();

  return (
    <Card className="card-shadow-medium overflow-hidden border border-[hsl(var(--color-border-primary))]">
      <CardContent className="bg-[hsl(var(--color-bg-secondary))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="card-shadow-light flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
              <PackageX className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                出库记录
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                查看和管理产品出库记录，跟踪库存减少情况
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="h-11 gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

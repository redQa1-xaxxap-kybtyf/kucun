'use client';

import { Package, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function ProductListToolbar() {
  const router = useRouter();

  return (
    <Card className="border-border overflow-hidden border shadow-sm">
      <CardContent className="bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))]">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                产品资料
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                产品编码、库存和分类
              </p>
            </div>
          </div>
          <Button
            onClick={() => router.push('/products/create')}
            size="lg"
            className="h-10 gap-2 rounded-md"
          >
            <Plus className="h-5 w-5" />
            新增产品
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

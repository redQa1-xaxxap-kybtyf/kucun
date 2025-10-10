'use client';

import { Package, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ProductListToolbarProps {
  selectedCount: number;
  onBatchDelete: () => void;
}

export function ProductListToolbar({
  selectedCount,
  onBatchDelete,
}: ProductListToolbarProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] text-[hsl(var(--color-text-on-primary))] shadow-[var(--shadow-light)]">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                产品管理
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                管理产品信息、库存和分类
              </p>
            </div>
            {selectedCount > 0 && (
              <div className="ml-4 flex items-center gap-2 rounded-lg border border-[hsl(var(--color-border-primary))] bg-[hsl(var(--color-primary-light))] px-3 py-2">
                <span className="text-sm font-medium text-[hsl(var(--color-primary))]">
                  已选择 {selectedCount} 个产品
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onBatchDelete}
                  className="h-8"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  批量删除
                </Button>
              </div>
            )}
          </div>
          <Button
            onClick={() => router.push('/products/create')}
            size="lg"
            className="h-11 gap-2 transition-transform duration-150 hover:scale-[1.02]"
            style={{ boxShadow: 'var(--shadow-light)' }}
          >
            <Plus className="h-5 w-5" />
            新增产品
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">产品管理</h1>
        {selectedCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              已选择 {selectedCount} 个产品
            </span>
            <Button variant="destructive" size="sm" onClick={onBatchDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              批量删除
            </Button>
          </div>
        )}
      </div>
      <Button onClick={() => router.push('/products/create')}>
        <Plus className="mr-2 h-4 w-4" />
        新增产品
      </Button>
    </div>
  );
}

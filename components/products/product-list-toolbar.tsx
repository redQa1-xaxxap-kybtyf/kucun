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
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                产品管理
              </h1>
              <p className="text-sm text-gray-600">管理产品信息、库存和分类</p>
            </div>
            {selectedCount > 0 && (
              <div className="ml-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                <span className="text-sm font-medium text-blue-900">
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
            className="h-11 gap-2 bg-blue-600 shadow-md shadow-blue-600/30 transition-all hover:scale-105 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/40"
          >
            <Plus className="h-5 w-5" />
            新增产品
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

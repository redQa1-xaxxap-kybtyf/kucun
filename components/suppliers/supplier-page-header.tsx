'use client';

/**
 * 供应商页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-page-header.tsx
 */

import { Building2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SupplierPageHeaderProps {
  selectedSupplierIds: string[];
  onBatchDelete: () => void;
  isBatchDeleting: boolean;
}

export function SupplierPageHeader({
  selectedSupplierIds,
  onBatchDelete,
  isBatchDeleting,
}: SupplierPageHeaderProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                供应商管理
              </h1>
              <p className="text-sm text-gray-600">
                管理供应商信息
                {selectedSupplierIds.length > 0 && (
                  <span className="ml-2 font-medium text-blue-600">
                    · 已选择 {selectedSupplierIds.length} 个供应商
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedSupplierIds.length > 0 && (
              <Button
                variant="destructive"
                size="lg"
                onClick={onBatchDelete}
                disabled={isBatchDeleting}
                className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    批量删除 ({selectedSupplierIds.length})
                  </>
                )}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => router.push('/suppliers/create')}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建供应商
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

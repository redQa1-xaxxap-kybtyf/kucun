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
    <Card className="overflow-hidden">
      <CardContent className="bg-gradient-to-r from-[hsl(var(--color-primary-light))] to-[hsl(var(--color-primary-lighter))] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--color-primary))] shadow-[0_10px_24px_rgba(9,88,217,0.22)]">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                供应商管理
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                管理供应商信息
                {selectedSupplierIds.length > 0 && (
                  <span className="ml-2 font-medium text-[hsl(var(--color-primary))]">
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
                className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
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
              className="h-11 shadow-[var(--shadow-light)] transition-transform hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)]"
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

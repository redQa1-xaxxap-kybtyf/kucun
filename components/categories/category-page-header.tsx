'use client';

/**
 * 分类页面头部组件
 * 严格遵循全栈项目统一约定规范
 */

import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';

interface CategoryPageHeaderProps {
  selectedCategoryIds: string[];
  onBatchDelete: () => void;
  isBatchDeleting: boolean;
}

export function CategoryPageHeader({
  selectedCategoryIds,
  onBatchDelete,
  isBatchDeleting,
}: CategoryPageHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">分类管理</h1>
        <p className="text-muted-foreground">
          管理产品分类和层级结构
          {selectedCategoryIds.length > 0 && (
            <span className="ml-2 text-blue-600">
              已选择 {selectedCategoryIds.length} 个分类
            </span>
          )}
        </p>
      </div>
      <div className="flex gap-2">
        {selectedCategoryIds.length > 0 && (
          <Button
            variant="destructive"
            onClick={onBatchDelete}
            disabled={isBatchDeleting}
          >
            {isBatchDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                删除中...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                批量删除 ({selectedCategoryIds.length})
              </>
            )}
          </Button>
        )}
        <Button onClick={() => router.push('/categories/create')}>
          <Plus className="mr-2 h-4 w-4" />
          新建分类
        </Button>
      </div>
    </div>
  );
}

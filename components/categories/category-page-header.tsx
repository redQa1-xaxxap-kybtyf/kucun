'use client';

/**
 * 分类页面头部组件
 * 严格遵循全栈项目统一约定规范
 */

import { FolderTree, Loader2, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
    <Card className="overflow-hidden shadow-lg shadow-gray-200/50">
      <CardContent className="bg-gradient-to-r from-slate-50 to-gray-50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
              <FolderTree className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                分类管理
              </h1>
              <p className="text-sm text-gray-600">
                管理产品分类和层级结构
                {selectedCategoryIds.length > 0 && (
                  <span className="ml-2 font-medium text-blue-600">
                    · 已选择 {selectedCategoryIds.length} 个分类
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedCategoryIds.length > 0 && (
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
                    批量删除 ({selectedCategoryIds.length})
                  </>
                )}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => router.push('/categories/create')}
              className="h-11 shadow-md transition-all hover:scale-105 hover:shadow-lg"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建分类
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

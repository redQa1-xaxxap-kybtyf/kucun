'use client';

/**
 * 客户页面头部组件
 * 严格遵循全栈项目统一约定规范
 * 参考：components/categories/category-page-header.tsx
 */

import { Loader2, Plus, Trash2, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface CustomerPageHeaderProps {
  selectedCustomerIds: string[];
  onBatchDelete: () => void;
  isBatchDeleting: boolean;
}

export function CustomerPageHeader({
  selectedCustomerIds,
  onBatchDelete,
  isBatchDeleting,
}: CustomerPageHeaderProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden border border-border shadow-sm">
      <CardContent className="bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[hsl(var(--color-primary))]">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[hsl(var(--color-text-primary))]">
                客户档案
              </h1>
              <p className="text-sm text-[hsl(var(--color-text-secondary))]">
                管理客户信息和交易记录
                {selectedCustomerIds.length > 0 && (
                  <span className="ml-2 font-medium text-[hsl(var(--color-primary))]">
                    · 已选择 {selectedCustomerIds.length} 个客户
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedCustomerIds.length > 0 && (
              <Button
                variant="destructive"
                size="lg"
                onClick={onBatchDelete}
                disabled={isBatchDeleting}
                className="h-10 rounded-md"
              >
                {isBatchDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    删除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    批量删除 ({selectedCustomerIds.length})
                  </>
                )}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => router.push('/customers/create')}
              className="h-10 rounded-md"
            >
              <Plus className="mr-2 h-4 w-4" />
              新建客户
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

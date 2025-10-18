import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SupplierSearchEmptyStateProps {
  searchValue: string;
  isLoading: boolean;
  onAddSupplier: () => void;
}

export function SupplierSearchEmptyState({
  searchValue,
  isLoading,
  onAddSupplier,
}: SupplierSearchEmptyStateProps) {
  const hasQuery = Boolean(searchValue);
  const displayValue =
    hasQuery && searchValue.length > 24
      ? `${searchValue.slice(0, 24)}...`
      : searchValue;

  return (
    <div className="py-6 text-center">
      <div className="space-y-3">
        <div className="text-muted-foreground text-sm">
          {isLoading ? (
            '正在加载供应商...'
          ) : hasQuery ? (
            <span>
              未找到供应商{' '}
              <mark className="rounded bg-amber-100 px-1 text-amber-900">
                {displayValue}
              </mark>
            </span>
          ) : (
            '请输入供应商名称或电话进行搜索，或直接创建新供应商'
          )}
        </div>
        {!isLoading && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddSupplier}
            className="h-8"
          >
            <Plus className="mr-2 h-3 w-3" />
            新增供应商
          </Button>
        )}
      </div>
    </div>
  );
}

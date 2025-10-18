import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface ProductSearchEmptyStateProps {
  searchValue: string;
  isSearching: boolean;
  allowTemporaryProducts: boolean;
  onAddTemporaryProduct: () => void;
}

export function ProductSearchEmptyState({
  searchValue,
  isSearching,
  allowTemporaryProducts,
  onAddTemporaryProduct,
}: ProductSearchEmptyStateProps) {
  const displayValue =
    searchValue.length > 32 ? `${searchValue.slice(0, 32)}...` : searchValue;

  return (
    <div className="py-6 text-center">
      <div className="space-y-3">
        <div className="text-muted-foreground">
          {isSearching ? (
            '正在搜索商品...'
          ) : searchValue ? (
            <span>
              未找到匹配的商品{' '}
              <mark className="rounded bg-amber-100 px-1 text-amber-900">
                {displayValue}
              </mark>
            </span>
          ) : (
            '请输入关键词搜索商品'
          )}
        </div>
        {allowTemporaryProducts && searchValue && !isSearching && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTemporaryProduct}
            className="mx-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加为临时商品
          </Button>
        )}
      </div>
    </div>
  );
}

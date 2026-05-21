import { Plus, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProductSearchEmptyStateProps {
  searchValue: string;
  isSearching: boolean;
  allowTemporaryProducts: boolean;
  onAddTemporaryProduct: () => void;
  variant?: 'desktop' | 'mobile';
}

export function ProductSearchEmptyState({
  searchValue,
  isSearching,
  allowTemporaryProducts,
  onAddTemporaryProduct,
  variant = 'desktop',
}: ProductSearchEmptyStateProps) {
  const isMobile = variant === 'mobile';
  const displayValue =
    searchValue.length > 32 ? `${searchValue.slice(0, 32)}...` : searchValue;

  return (
    <div className={cn('text-center', isMobile ? 'px-4 py-10' : 'py-6')}>
      <div className="space-y-3">
        {!isSearching && !searchValue && (
          <Search
            className={cn(
              'mx-auto text-muted-foreground',
              isMobile ? 'h-8 w-8' : 'h-5 w-5'
            )}
          />
        )}
        <div className="text-muted-foreground">
          {isSearching ? (
            '正在搜索产品...'
          ) : searchValue ? (
            <span>
              未找到匹配的产品{' '}
              <mark className="rounded bg-amber-100 px-1 text-amber-900">
                {displayValue}
              </mark>
            </span>
          ) : (
            '请输入产品名称、编码或规格搜索'
          )}
        </div>
        {allowTemporaryProducts && searchValue && !isSearching && (
          <Button
            variant="outline"
            size={isMobile ? 'default' : 'sm'}
            onClick={onAddTemporaryProduct}
            className={cn(isMobile ? 'h-11 w-full' : 'mx-auto')}
          >
            <Plus className="mr-2 h-4 w-4" />
            手动录入产品
          </Button>
        )}
      </div>
    </div>
  );
}

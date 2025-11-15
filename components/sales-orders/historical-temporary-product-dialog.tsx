'use client';

import { Clock, Package, Search } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useHistoricalTemporaryProducts } from '@/hooks/use-historical-temporary-products';
import type { HistoricalTemporaryProduct } from '@/lib/types/temporary-product';

interface HistoricalTemporaryProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string | null;
  onSelect: (product: HistoricalTemporaryProduct) => void;
}

export function HistoricalTemporaryProductDialog({
  open,
  onOpenChange,
  supplierId,
  onSelect,
}: HistoricalTemporaryProductDialogProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useHistoricalTemporaryProducts({
    supplierId: supplierId || undefined,
    search: search || undefined,
    page,
    limit: 20,
  });

  const handleSelect = (product: HistoricalTemporaryProduct) => {
    onSelect(product);
    onOpenChange(false);
    setSearch('');
    setPage(1);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSearch('');
    setPage(1);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            选择历史临时产品
          </DialogTitle>
          <DialogDescription>
            从历史记录中快速选择常用的临时产品，自动填充产品信息
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索产品名称或规格..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 产品列表 */}
          <ScrollArea className="h-[400px] rounded-md border">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                加载中...
              </div>
            ) : !data?.data.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                <Package className="h-12 w-12 opacity-20" />
                <p>暂无历史临时产品</p>
                {search && <p className="text-sm">尝试修改搜索关键词</p>}
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {data.data.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {/* 分页信息 */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                第 {data.pagination.page} / {data.pagination.totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage(p => Math.min(data.pagination.totalPages, p + 1))
                  }
                  disabled={page === data.pagination.totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProductCardProps {
  product: HistoricalTemporaryProduct;
  onSelect: (product: HistoricalTemporaryProduct) => void;
}

function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          {/* 产品名称 */}
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{product.name}</h4>
            <Badge variant="secondary" className="text-xs">
              {product.code}
            </Badge>
          </div>

          {/* 规格信息 */}
          {product.specification && (
            <p className="text-sm text-muted-foreground">
              规格: {product.specification}
            </p>
          )}

          {/* 单位和重量 */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>单位: {product.unit}</span>
            <span>每件片数: {product.piecesPerUnit}</span>
            {product.weight && <span>重量: {product.weight}kg</span>}
          </div>
        </div>

        {/* 使用统计 */}
        <div className="flex flex-col items-end gap-1 text-sm">
          <Badge variant="outline" className="text-xs">
            使用 {product.usageCount} 次
          </Badge>
          {product.lastUsedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(product.lastUsedAt).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}


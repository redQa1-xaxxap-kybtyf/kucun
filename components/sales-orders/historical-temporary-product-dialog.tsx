'use client';

import { Package, Search } from 'lucide-react';
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
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            选择外采产品
          </DialogTitle>
          <DialogDescription>
            从该供应商维护的外采产品库中选择，自动带出编码、规格、包装、重量和内部参考价格
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="搜索编码、名称或规格"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] rounded-md border">
            {isLoading ? (
              <div className="text-muted-foreground flex h-full items-center justify-center">
                正在加载外采产品...
              </div>
            ) : !data?.data.length ? (
              <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2">
                <Package className="h-12 w-12 opacity-20" />
                <p>暂无外采产品</p>
                {search && <p className="text-sm">换个编码、名称或规格试试</p>}
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

          {data && data.pagination.totalPages > 1 && (
            <div className="text-muted-foreground flex items-center justify-between text-sm">
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

function formatCurrency(
  value: number | null | undefined,
  fractionDigits: number
) {
  if (value === null || value === undefined) {
    return '未维护';
  }

  return `￥${value.toLocaleString('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('zh-CN');
}

interface ProductCardProps {
  product: HistoricalTemporaryProduct;
  onSelect: (product: HistoricalTemporaryProduct) => void;
}

function ProductCard({ product, onSelect }: ProductCardProps) {
  const latestDate = formatDate(
    product.latestPriceDate ?? product.priceUpdatedAt ?? product.lastUsedAt
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(product)}
      className="bg-card hover:bg-accent w-full rounded-md border p-3 text-left transition-colors"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              外采
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {product.code}
            </Badge>
            {!product.showInMiniProgram && (
              <Badge variant="outline" className="text-xs">
                小程序隐藏
              </Badge>
            )}
            <h4 className="min-w-0 font-medium text-[hsl(var(--color-text-primary))]">
              {product.name}
            </h4>
          </div>

          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>规格：{product.specification || '-'}</span>
            <span>单位：{product.unit}</span>
            <span>装箱数：{product.piecesPerUnit} 片/件</span>
            {product.weight ? <span>重量：{product.weight} kg</span> : null}
          </div>

          {product.priceRemarks ? (
            <div className="mt-2 line-clamp-1 text-xs text-[hsl(var(--color-text-tertiary))]">
              价格备注：{product.priceRemarks}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-[210px] grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-2 py-1.5">
            <div className="text-[hsl(var(--color-text-tertiary))]">
              成本
            </div>
            <div className="mt-0.5 font-semibold text-[hsl(var(--color-text-primary))]">
              {formatCurrency(product.latestCostPrice, 3)}
            </div>
          </div>
          <div className="rounded-md bg-[hsl(var(--color-bg-secondary))] px-2 py-1.5">
            <div className="text-[hsl(var(--color-text-tertiary))]">
              参考售价
            </div>
            <div className="mt-0.5 font-semibold text-orange-600">
              {formatCurrency(product.latestSalePrice, 2)}
            </div>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-2 text-[hsl(var(--color-text-tertiary))]">
            <span>{product.latestPriceSource || '产品库'}</span>
            <span>
              使用 {product.usageCount} 次{latestDate ? ` · ${latestDate}` : ''}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

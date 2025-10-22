'use client';

import { Check, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';
import { cn } from '@/lib/utils';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface ProductOptionItemProps {
  product: ProductOption;
  isSelected: boolean;
}

export function ProductOptionItem({
  product,
  isSelected,
}: ProductOptionItemProps) {
  const batchSpecs = product.batchSpecs ?? [];
  const isMultipleBatches = batchSpecs.length > 1;

  // 库存显示逻辑
  const stockDisplay = React.useMemo(() => {
    const totalPieces = product.currentStock ?? 0;
    if (!totalPieces || totalPieces <= 0) {
      return '0片';
    }

    // 如果有多个批次，每个批次的每件片数可能不同，只显示总片数
    if (isMultipleBatches) {
      return `${totalPieces}片 (多批次)`;
    }

    // 如果只有一个批次或没有批次，使用该批次的每件片数或产品默认值
    const effectivePiecesPerUnit =
      batchSpecs.length > 0
        ? batchSpecs[0].piecesPerUnit || 1
        : product.piecesPerUnit || 1;

    return formatPieceSummary(totalPieces, effectivePiecesPerUnit, {
      fallbackUnit: '片',
    });
  }, [
    product.currentStock,
    product.piecesPerUnit,
    batchSpecs,
    isMultipleBatches,
  ]);

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Package className="text-muted-foreground h-4 w-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* 产品编码 - 高亮显示 */}
          <span className="font-mono text-base font-semibold text-[hsl(var(--color-primary))]">
            {product.code}
          </span>
          {/* 产品名称和规格 - 普通样式 */}
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-muted-foreground truncate text-xs">
              {product.label}
            </span>
            {product.specification && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-muted-foreground truncate text-xs">
                  {product.specification}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* 库存信息 */}
      <div className="flex shrink-0 items-center gap-2">
        <Badge
          variant="outline"
          className="border-green-600 bg-green-50 font-mono text-xs font-semibold text-green-700"
        >
          库存: {stockDisplay}
        </Badge>
        <Check
          className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
        />
      </div>
    </div>
  );
}

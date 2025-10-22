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

  // 获取实际每件片数：优先使用批次规格中的值（用于库存计算）
  const effectivePiecesPerUnit = React.useMemo(() => {
    if (batchSpecs.length > 0) {
      return batchSpecs[0].piecesPerUnit || 1;
    }
    return product.piecesPerUnit || 1;
  }, [batchSpecs, product.piecesPerUnit]);

  const piecesPerUnitDisplay = React.useMemo(() => {
    if (batchSpecs.length === 0) {
      const value = product.piecesPerUnit;
      return value && value > 0 ? `每件${value}片` : null;
    }
    if (batchSpecs.length === 1) {
      return `每件${batchSpecs[0].piecesPerUnit}片`;
    }
    return '多批次，请选择批次';
  }, [batchSpecs, product.piecesPerUnit]);

  const stockDisplay = React.useMemo(() => {
    const totalPieces = product.currentStock ?? 0;
    if (!totalPieces || totalPieces <= 0) {
      return '0片';
    }

    // 调试：打印实际值
    if (process.env.NODE_ENV === 'development') {
      console.log('产品库存计算:', {
        code: product.code,
        totalPieces,
        productPiecesPerUnit: product.piecesPerUnit,
        effectivePiecesPerUnit,
        hasBatchSpecs: !!product.batchSpecs,
        batchSpecsLength: product.batchSpecs?.length,
      });
    }

    return formatPieceSummary(totalPieces, effectivePiecesPerUnit, {
      fallbackUnit: '片',
    });
  }, [
    product.currentStock,
    effectivePiecesPerUnit,
    product.code,
    product.piecesPerUnit,
    product.batchSpecs,
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
          {/* 产品名称、规格和每件片数 - 普通样式 */}
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
            {/* 每件片数显示 */}
            {piecesPerUnitDisplay && (
              <>
                <span className="text-muted-foreground text-xs">·</span>
                <span
                  className={
                    isMultipleBatches
                      ? 'text-xs text-amber-600'
                      : 'text-muted-foreground text-xs'
                  }
                >
                  {piecesPerUnitDisplay}
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

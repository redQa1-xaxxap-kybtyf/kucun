'use client';

import { Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

interface SelectedProductDisplayProps {
  selectedProduct: ProductOption | null;
  placeholder: string;
}

export function SelectedProductDisplay({
  selectedProduct,
  placeholder,
}: SelectedProductDisplayProps) {
  const batchSpecs = selectedProduct?.batchSpecs ?? [];
  const isMultipleBatches = batchSpecs.length > 1;

  const effectivePiecesPerUnit = React.useMemo(() => {
    if (!selectedProduct) {
      return 1;
    }
    if (batchSpecs.length > 0) {
      return batchSpecs[0].piecesPerUnit || 1;
    }
    return selectedProduct.piecesPerUnit || 1;
  }, [batchSpecs, selectedProduct]);

  const piecesPerUnitDisplay = React.useMemo(() => {
    if (!selectedProduct) {
      return null;
    }
    if (batchSpecs.length === 0) {
      const value = selectedProduct.piecesPerUnit;
      return value && value > 0 ? `每件${value}片` : null;
    }
    if (batchSpecs.length === 1) {
      return `每件${batchSpecs[0].piecesPerUnit}片`;
    }
    return '多批次，请在下方选择批次';
  }, [batchSpecs, selectedProduct]);

  const stockDisplay = React.useMemo(() => {
    if (!selectedProduct) {
      return '0片';
    }

    const totalPieces = selectedProduct.currentStock || 0;
    if (!totalPieces || totalPieces <= 0) {
      return '0片';
    }

    return formatPieceSummary(totalPieces, effectivePiecesPerUnit, {
      fallbackUnit: '片',
    });
  }, [selectedProduct, effectivePiecesPerUnit]);

  if (!selectedProduct) {
    return <span className="text-muted-foreground">{placeholder}</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-3 overflow-hidden">
      <Package className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        {/* 产品编码 - 高亮显示 */}
        <span className="shrink-0 font-mono text-base font-semibold text-[hsl(var(--color-primary))]">
          {selectedProduct.code}
        </span>
        {/* 产品名称 - 普通样式 */}
        <span className="text-muted-foreground truncate text-sm">
          {selectedProduct.label}
        </span>
        {/* 规格信息 */}
        {selectedProduct.specification && (
          <>
            <span className="text-muted-foreground shrink-0 text-xs">·</span>
            <span className="text-muted-foreground truncate text-xs">
              {selectedProduct.specification}
            </span>
          </>
        )}
        {piecesPerUnitDisplay && (
          <>
            <span className="text-muted-foreground shrink-0 text-xs">·</span>
            <span
              className={
                isMultipleBatches
                  ? 'shrink-0 text-xs text-amber-600'
                  : 'text-muted-foreground shrink-0 text-xs'
              }
            >
              {piecesPerUnitDisplay}
            </span>
          </>
        )}
        {/* 库存显示 */}
        <Badge
          variant="outline"
          className="shrink-0 border-green-600 bg-green-50 font-mono text-xs font-semibold text-green-700"
        >
          库存: {stockDisplay}
        </Badge>
      </div>
    </div>
  );
}

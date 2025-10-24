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
  const batchSpecs = React.useMemo(
    () => selectedProduct?.batchSpecs ?? [],
    [selectedProduct]
  );
  const isMultipleBatches = batchSpecs.length > 1;

  // 库存显示逻辑
  const stockDisplay = React.useMemo(() => {
    if (!selectedProduct) {
      return '0片';
    }

    const totalPieces = selectedProduct.currentStock || 0;
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
        : selectedProduct.piecesPerUnit || 1;

    return formatPieceSummary(totalPieces, effectivePiecesPerUnit, {
      fallbackUnit: '片',
    });
  }, [selectedProduct, batchSpecs, isMultipleBatches]);

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

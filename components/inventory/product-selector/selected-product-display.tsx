'use client';

import { Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';

interface SelectedProductDisplayProps {
  selectedProduct: ProductOption | null;
  placeholder: string;
}

export function SelectedProductDisplay({
  selectedProduct,
  placeholder,
}: SelectedProductDisplayProps) {
  if (!selectedProduct) {
    return <span className="text-muted-foreground">{placeholder}</span>;
  }

  // 计算件数和剩余片数
  const totalPieces = selectedProduct.currentStock || 0;
  const piecesPerUnit = selectedProduct.piecesPerUnit || 1;
  const units = Math.floor(totalPieces / piecesPerUnit);
  const remainingPieces = totalPieces % piecesPerUnit;

  // 格式化库存显示
  let stockDisplay = '';
  if (units > 0 && remainingPieces > 0) {
    stockDisplay = `${units}件+${remainingPieces}片`;
  } else if (units > 0) {
    stockDisplay = `${units}件`;
  } else {
    stockDisplay = `${remainingPieces}片`;
  }

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
      <Package className="text-muted-foreground h-4 w-4 shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <span className="truncate text-sm font-medium">
          {selectedProduct.label}
        </span>
        <Badge variant="secondary" className="shrink-0 text-xs">
          {selectedProduct.code}
        </Badge>
        <span className="text-muted-foreground shrink-0 text-xs">
          库存: {stockDisplay}
        </span>
      </div>
    </div>
  );
}

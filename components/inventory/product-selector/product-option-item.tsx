'use client';

import { Check, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import { cn } from '@/lib/utils';

interface ProductOptionItemProps {
  product: ProductOption;
  isSelected: boolean;
}

export function ProductOptionItem({
  product,
  isSelected,
}: ProductOptionItemProps) {
  const stockDisplay = React.useMemo(() => {
    const totalPieces = product.currentStock ?? 0;
    if (!totalPieces || totalPieces <= 0) {
      return '0片';
    }
    return formatPieceSummary(totalPieces, product.piecesPerUnit, {
      fallbackUnit: '片',
    });
  }, [product.currentStock, product.piecesPerUnit]);

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Package className="text-muted-foreground h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{product.label}</span>
            <Badge variant="outline" className="text-xs">
              {product.code}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs">
            库存: {stockDisplay}
          </div>
        </div>
      </div>
      <Check
        className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

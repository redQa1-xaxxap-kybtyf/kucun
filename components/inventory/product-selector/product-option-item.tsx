'use client';

import { Check, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { cn } from '@/lib/utils';

interface ProductOptionItemProps {
  product: ProductOption;
  isSelected: boolean;
}

export function ProductOptionItem({
  product,
  isSelected,
}: ProductOptionItemProps) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Package className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{product.label}</span>
            <Badge variant="outline" className="text-xs">
              {product.code}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            库存: {product.currentStock}{' '}
            {PRODUCT_UNIT_LABELS[product.unit] || product.unit}
          </div>
        </div>
      </div>
      <Check
        className={cn('h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

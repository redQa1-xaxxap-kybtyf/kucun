'use client';

import { Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import type { ProductOption } from '@/lib/types/inbound';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';

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

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{selectedProduct.label}</span>
          <Badge variant="secondary" className="text-xs">
            {selectedProduct.code}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          库存: {selectedProduct.currentStock}{' '}
          {PRODUCT_UNIT_LABELS[selectedProduct.unit] || selectedProduct.unit}
        </div>
      </div>
    </div>
  );
}

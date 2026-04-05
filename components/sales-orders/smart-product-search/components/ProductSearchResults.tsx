import { Check, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { getInventoryBatchAvailableQuantity } from '@/lib/utils/product-inventory';

import type { ProductWithInventory } from '../types';
import {
  buildHighlightTokens,
  buildProductKeywords,
  formatInventoryQuantity,
  formatProductSpecification,
  renderHighlightedText,
} from '../utils/product-search';

import { ProductBatchList } from './ProductBatchList';

interface ProductSearchResultsProps {
  products: ProductWithInventory[];
  selectedValue?: string;
  searchQuery: string;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
}

export function ProductSearchResults({
  products,
  selectedValue,
  searchQuery,
  onSelectProduct,
  onSelectBatch,
}: ProductSearchResultsProps) {
  const highlightTokens = React.useMemo(
    () => buildHighlightTokens(searchQuery),
    [searchQuery]
  );

  return (
    <CommandGroup>
      {products.map(product => (
        <ProductSearchResultItem
          key={product.id}
          product={product}
          isSelected={selectedValue === product.id}
          onSelectProduct={onSelectProduct}
          onSelectBatch={onSelectBatch}
          highlightTokens={highlightTokens}
        />
      ))}
    </CommandGroup>
  );
}

interface ProductSearchResultItemProps {
  product: ProductWithInventory;
  isSelected: boolean;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
  highlightTokens: string[];
}

const productSearchResultItemClassName =
  'flex items-start justify-between gap-4 p-4';

const ProductSearchResultItem = React.memo<ProductSearchResultItemProps>(
  ({
    product,
    isSelected,
    onSelectProduct,
    onSelectBatch,
    highlightTokens,
  }) => {
    const specification = React.useMemo(
      () => formatProductSpecification(product.specification),
      [product.specification]
    );
    const piecesPerUnit = product.piecesPerUnit ?? 0;

    // 检查是否有多个批次
    const batches = React.useMemo(() => {
      const inventoryBatches = product.inventory?.batches ?? [];
      const batchSpecs = product.batchSpecs ?? [];

      if (inventoryBatches.length === 0 && batchSpecs.length === 0) {
        return [];
      }

      const specMap = new Map(batchSpecs.map(spec => [spec.batchNumber, spec]));

      if (inventoryBatches.length > 0) {
        return inventoryBatches
          .map(batch => {
            const spec = specMap.get(batch.batchNumber);
            const normalizedPieces =
              typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
                ? batch.piecesPerUnit
                : spec?.piecesPerUnit;
            const availableQuantity = getInventoryBatchAvailableQuantity(batch);

            return {
              batchNumber: batch.batchNumber,
              quantity: availableQuantity,
              piecesPerUnit: normalizedPieces,
            };
          })
          .filter(batch => batch.quantity > 0);
      }

      return batchSpecs.map(spec => ({
        batchNumber: spec.batchNumber,
        quantity: spec.quantity,
        piecesPerUnit: spec.piecesPerUnit,
      }));
    }, [product]);

    const isMultipleBatches = batches.length > 1;

    // 库存显示逻辑：多批次只显示片数，单批次或无批次显示件数+片数
    const availableDisplay = React.useMemo(() => {
      const availableQty = product.inventory?.availableInventory ?? 0;
      if (isMultipleBatches) {
        return `${availableQty}片 (多批次)`;
      }
      const effectivePiecesPerUnit =
        batches.length > 0 ? batches[0].piecesPerUnit || 1 : piecesPerUnit || 1;
      return formatInventoryQuantity(availableQty, effectivePiecesPerUnit);
    }, [
      product.inventory?.availableInventory,
      piecesPerUnit,
      batches,
      isMultipleBatches,
    ]);

    const totalDisplay = React.useMemo(() => {
      const totalQty = product.inventory?.totalInventory ?? 0;
      if (isMultipleBatches) {
        return `${totalQty}片 (多批次)`;
      }
      const effectivePiecesPerUnit =
        batches.length > 0 ? batches[0].piecesPerUnit || 1 : piecesPerUnit || 1;
      return formatInventoryQuantity(totalQty, effectivePiecesPerUnit);
    }, [
      product.inventory?.totalInventory,
      piecesPerUnit,
      batches,
      isMultipleBatches,
    ]);

    const renderedKeywords = React.useMemo(
      () => buildProductKeywords(product, specification),
      [product, specification]
    );

    return (
      <CommandItem
        value={renderedKeywords.join(' ')}
        keywords={renderedKeywords}
        onSelect={() => onSelectProduct(product.id)}
        className={productSearchResultItemClassName}
      >
        <ProductResultInfo
          product={product}
          isSelected={isSelected}
          specification={specification}
          piecesPerUnit={piecesPerUnit}
          batches={batches}
          highlightTokens={highlightTokens}
          onSelectBatch={onSelectBatch}
        />
        <ProductInventorySummary
          availableDisplay={availableDisplay}
          totalDisplay={totalDisplay}
          hasInventory={Boolean(product.inventory)}
          showTotal={
            product.inventory?.totalInventory !==
            product.inventory?.availableInventory
          }
        />
      </CommandItem>
    );
  }
);

ProductSearchResultItem.displayName = 'ProductSearchResultItem';

interface ProductResultInfoProps {
  product: ProductWithInventory;
  isSelected: boolean;
  specification: string;
  piecesPerUnit: number;
  batches: Array<{
    batchNumber: string;
    quantity: number;
    piecesPerUnit?: number;
  }>;
  highlightTokens: string[];
  onSelectBatch: (productId: string, batchNumber: string) => void;
}

function ProductResultInfo({
  product,
  isSelected,
  specification,
  piecesPerUnit,
  batches,
  highlightTokens,
  onSelectBatch,
}: ProductResultInfoProps) {
  const highlightedCode = React.useMemo(
    () => renderHighlightedText(product.code, highlightTokens),
    [highlightTokens, product.code]
  );
  const highlightedName = React.useMemo(
    () => renderHighlightedText(product.name, highlightTokens),
    [highlightTokens, product.name]
  );
  const highlightedSpecification = React.useMemo(
    () => renderHighlightedText(specification, highlightTokens),
    [highlightTokens, specification]
  );

  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <Check
        className={cn(
          'h-4 w-4 shrink-0',
          isSelected ? 'opacity-100' : 'opacity-0'
        )}
      />
      <Package className="text-muted-foreground h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          {product.code && (
            <Badge
              variant="outline"
              className="border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] px-2.5 py-0.5 font-mono text-xs font-bold text-[hsl(var(--color-primary))] shadow-sm"
            >
              {highlightedCode}
            </Badge>
          )}
          <span className="font-semibold text-gray-900">{highlightedName}</span>
          {product.status === 'inactive' && (
            <Badge variant="secondary" className="text-xs">
              停用
            </Badge>
          )}
        </div>
        {specification && (
          <div className="text-sm text-gray-600">
            规格：{highlightedSpecification}
          </div>
        )}
        {batches.length > 0 && (
          <ProductBatchList
            productId={product.id}
            batches={batches}
            piecesPerUnit={piecesPerUnit}
            onSelectBatch={onSelectBatch}
          />
        )}
      </div>
    </div>
  );
}

interface ProductInventorySummaryProps {
  availableDisplay: string;
  totalDisplay: string;
  hasInventory: boolean;
  showTotal: boolean;
}

function ProductInventorySummary({
  availableDisplay,
  totalDisplay,
  hasInventory,
  showTotal,
}: ProductInventorySummaryProps) {
  if (!hasInventory) {
    return (
      <div className="rounded-md bg-gray-50 px-3 py-1">
        <div className="text-xs text-gray-500">无库存信息</div>
      </div>
    );
  }

  return (
    <div className="shrink-0 space-y-1 text-right">
      <div className="rounded-md bg-green-50 px-3 py-1">
        <div className="text-xs text-gray-600">可用库存</div>
        <div className="text-sm font-semibold text-green-600">
          {availableDisplay}
        </div>
      </div>
      {showTotal && (
        <div className="text-xs text-gray-500">总量 {totalDisplay}</div>
      )}
    </div>
  );
}

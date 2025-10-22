import { Check, Package } from 'lucide-react';
import React from 'react';

import { Badge } from '@/components/ui/badge';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';

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
  'flex items-start justify-between gap-6 p-4 hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-b-0';

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
        return inventoryBatches.map(batch => {
          const spec = specMap.get(batch.batchNumber);
          const normalizedPieces =
            typeof batch.piecesPerUnit === 'number' && batch.piecesPerUnit > 0
              ? batch.piecesPerUnit
              : spec?.piecesPerUnit;

          return {
            batchNumber: batch.batchNumber,
            quantity: batch.quantity,
            piecesPerUnit: normalizedPieces,
          };
        });
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
          'h-5 w-5 shrink-0 text-green-600',
          isSelected ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div className="min-w-0 flex-1 space-y-2">
        {/* 产品编码 - 更突出 */}
        {product.code && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-blue-400 bg-blue-600 px-3 py-1 font-mono text-sm font-bold text-white shadow-sm"
            >
              {highlightedCode}
            </Badge>
            {product.status === 'inactive' && (
              <Badge variant="secondary" className="text-xs">
                停用
              </Badge>
            )}
          </div>
        )}
        {/* 产品名称 */}
        <div className="text-base font-semibold text-gray-900">
          {highlightedName}
        </div>
        {/* 规格 */}
        {specification && (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Package className="h-3.5 w-3.5 text-gray-400" />
            <span>{highlightedSpecification}</span>
          </div>
        )}
        {/* 批次列表 */}
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
      <div className="flex h-full items-center rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-center">
          <div className="text-xs font-medium text-gray-400">无库存</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 text-right">
      <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50 to-white px-4 py-3 shadow-sm">
        <div className="mb-1 text-[10px] font-medium tracking-wide text-green-600 uppercase">
          可用库存
        </div>
        <div className="text-lg font-bold text-green-700">
          {availableDisplay}
        </div>
        {showTotal && (
          <div className="mt-1 text-xs text-gray-500">
            总量 <span className="font-medium">{totalDisplay}</span>
          </div>
        )}
      </div>
    </div>
  );
}

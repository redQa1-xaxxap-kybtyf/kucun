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
  variant?: 'desktop' | 'mobile';
}

export function ProductSearchResults({
  products,
  selectedValue,
  searchQuery,
  onSelectProduct,
  onSelectBatch,
  variant = 'desktop',
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
          variant={variant}
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
  variant: 'desktop' | 'mobile';
}

const ProductSearchResultItem = React.memo<ProductSearchResultItemProps>(
  ({
    product,
    isSelected,
    onSelectProduct,
    onSelectBatch,
    highlightTokens,
    variant,
  }) => {
    const isMobile = variant === 'mobile';
    const specification = React.useMemo(
      () => formatProductSpecification(product.specification),
      [product.specification]
    );
    const piecesPerUnit = product.piecesPerUnit ?? 0;

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

    const availableDisplay = React.useMemo(() => {
      const availableQty = product.inventory?.availableInventory ?? 0;
      if (isMultipleBatches) {
        return `${availableQty}片 (多批次)`;
      }
      const effectivePiecesPerUnit =
        batches.length > 0
          ? (batches[0].piecesPerUnit ?? 0)
          : (piecesPerUnit ?? 0);
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
        batches.length > 0
          ? (batches[0].piecesPerUnit ?? 0)
          : (piecesPerUnit ?? 0);
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

    const showTotal =
      product.inventory?.totalInventory !==
      product.inventory?.availableInventory;

    // 移动端 + 多批次：卡片本身不响应点击，仅批次按钮可点
    const handleSelect =
      isMobile && isMultipleBatches ? () => {} : () => onSelectProduct(product.id);

    if (isMobile) {
      return (
        <CommandItem
          value={renderedKeywords.join(' ')}
          keywords={renderedKeywords}
          onSelect={handleSelect}
          className={cn(
            'flex flex-col items-stretch gap-2 p-4',
            isMultipleBatches && 'cursor-default data-[selected=true]:bg-transparent'
          )}
        >
          <ProductMobileHeader
            product={product}
            highlightTokens={highlightTokens}
          />
          {specification && (
            <div className="text-xs text-gray-600">
              规格 {renderHighlightedText(specification, highlightTokens)}
              {piecesPerUnit > 0 && (
                <span className="text-gray-400"> · 每件 {piecesPerUnit} 片</span>
              )}
            </div>
          )}
          <ProductMobileInventoryRow
            availableDisplay={availableDisplay}
            totalDisplay={totalDisplay}
            hasInventory={Boolean(product.inventory)}
            showTotal={showTotal}
          />
          {batches.length > 0 && (
            <ProductBatchList
              productId={product.id}
              batches={batches}
              piecesPerUnit={piecesPerUnit}
              onSelectBatch={onSelectBatch}
              variant="mobile"
            />
          )}
        </CommandItem>
      );
    }

    return (
      <CommandItem
        value={renderedKeywords.join(' ')}
        keywords={renderedKeywords}
        onSelect={handleSelect}
        className="flex items-start justify-between gap-4 p-4"
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
          showTotal={showTotal}
        />
      </CommandItem>
    );
  }
);

ProductSearchResultItem.displayName = 'ProductSearchResultItem';

interface ProductMobileHeaderProps {
  product: ProductWithInventory;
  highlightTokens: string[];
}

function ProductMobileHeader({
  product,
  highlightTokens,
}: ProductMobileHeaderProps) {
  const highlightedCode = React.useMemo(
    () => renderHighlightedText(product.code, highlightTokens),
    [highlightTokens, product.code]
  );
  const highlightedName = React.useMemo(
    () => renderHighlightedText(product.name, highlightTokens),
    [highlightTokens, product.name]
  );

  return (
    <div className="flex items-center gap-2">
      {product.code && (
        <Badge
          variant="outline"
          className="border-[hsl(var(--color-primary-light))] bg-[hsl(var(--color-primary-light))] shrink-0 px-2 py-0.5 font-mono text-xs font-bold text-[hsl(var(--color-primary))]"
        >
          {highlightedCode}
        </Badge>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
        {highlightedName}
      </span>
      {product.status === 'inactive' && (
        <Badge variant="secondary" className="shrink-0 text-[11px]">
          停用
        </Badge>
      )}
    </div>
  );
}

interface ProductMobileInventoryRowProps {
  availableDisplay: string;
  totalDisplay: string;
  hasInventory: boolean;
  showTotal: boolean;
}

function ProductMobileInventoryRow({
  availableDisplay,
  totalDisplay,
  hasInventory,
  showTotal,
}: ProductMobileInventoryRowProps) {
  if (!hasInventory) {
    return <div className="text-xs text-gray-400">无库存信息</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2 text-xs">
      <div className="flex flex-col">
        <span className="text-gray-500">可用</span>
        <span className="font-semibold text-emerald-600 tabular-nums">
          {availableDisplay}
        </span>
      </div>
      <div className="flex flex-col text-right">
        <span className="text-gray-500">{showTotal ? '总量' : ''}</span>
        <span className="font-medium text-gray-700 tabular-nums">
          {showTotal ? totalDisplay : ''}
        </span>
      </div>
    </div>
  );
}

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

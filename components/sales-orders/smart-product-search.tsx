'use client';

import {
  Check,
  ChevronsUpDown,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { cn } from '@/lib/utils';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';
import {
  chineseToPinyinInitialsUppercase,
  chineseToPinyinUppercase,
} from '@/lib/utils/pinyin';
import { ProductDataUtils } from '@/lib/utils/product-data';

import { AddTemporaryProductDialog } from './add-temporary-product-dialog';

interface ProductWithInventory {
  id: string;
  code: string;
  name: string;
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number | null;
  status?: string;
  inventory?: {
    totalInventory: number;
    availableInventory: number;
    reservedInventory: number;
    batches?: Array<{
      batchNumber: string;
      quantity: number;
    }>;
  } | null;
}

interface SmartProductSearchProps {
  products: ProductWithInventory[];
  value?: string;
  onValueChange?: (value: string) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
  onTemporaryProductAdd?: (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowTemporaryProducts?: boolean;
  onSearchChange?: (query: string) => void;
  isSearching?: boolean;
  simple?: boolean;
}

export function SmartProductSearch(props: SmartProductSearchProps) {
  const {
    open,
    setOpen,
    searchValue,
    handleSearchValueChange,
    showAddDialog,
    setShowAddDialog,
    filteredProducts,
    selectedProduct,
    selectedSpecification,
    handleProductSelect,
    handleBatchSelect,
    handleAddTemporaryProduct,
    handleTemporaryProductAdded,
  } = useSmartProductSearchController(props);

  const {
    placeholder = '搜索商品',
    disabled = false,
    className,
    allowTemporaryProducts = false,
    isSearching = false,
    simple = false,
  } = props;

  const displaySearchValue = searchValue.trim();

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between text-left font-normal',
              !selectedProduct && 'text-muted-foreground',
              className
            )}
            disabled={disabled}
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex min-w-0 flex-col">
                {selectedProduct ? (
                  simple ? (
                    <span className="truncate text-sm text-gray-700">
                      {selectedProduct.code || selectedProduct.name}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-2 truncate">
                        {selectedProduct.code && (
                          <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 px-2 font-mono text-xs font-semibold text-blue-700"
                          >
                            {selectedProduct.code}
                          </Badge>
                        )}
                        <span className="font-medium">
                          {selectedProduct.name}
                        </span>
                      </span>
                      {selectedSpecification && (
                        <span className="text-muted-foreground truncate text-xs">
                          规格：{selectedSpecification}
                        </span>
                      )}
                    </>
                  )
                ) : (
                  placeholder
                )}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[620px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="输入商品名称、编码或规格搜索..."
              value={searchValue}
              onValueChange={handleSearchValueChange}
              className="h-10"
            />
            <CommandList className="max-h-[400px]">
              {isSearching && <ProductSearchLoadingIndicator />}
              {!displaySearchValue ? (
                <ProductSearchEmptyState
                  searchValue={displaySearchValue}
                  isSearching={isSearching}
                  allowTemporaryProducts={allowTemporaryProducts}
                  onAddTemporaryProduct={handleAddTemporaryProduct}
                />
              ) : filteredProducts.length > 0 ? (
                <ProductSearchResults
                  products={filteredProducts}
                  selectedValue={props.value}
                  searchQuery={displaySearchValue}
                  onSelectProduct={handleProductSelect}
                  onSelectBatch={handleBatchSelect}
                />
              ) : (
                <ProductSearchEmptyState
                  searchValue={displaySearchValue}
                  isSearching={isSearching}
                  allowTemporaryProducts={allowTemporaryProducts}
                  onAddTemporaryProduct={handleAddTemporaryProduct}
                />
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <AddTemporaryProductDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        initialName={searchValue}
        onConfirm={handleTemporaryProductAdded}
      />
    </>
  );
}

function useSmartProductSearchController({
  products,
  value,
  onValueChange,
  onBatchSelect,
  onTemporaryProductAdd,
  onSearchChange,
}: SmartProductSearchProps) {
  const [open, setOpen] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const {
    inputValue: searchValue,
    debouncedValue: debouncedSearchValue,
    setInputValue: setSearchValue,
    clearSearch,
  } = useDebouncedSearch({
    delay: 250,
  });

  const searchIndex = useMemo(
    () => buildProductSearchIndex(products),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) {
      return [];
    }
    return searchProducts(searchIndex.entries, trimmed);
  }, [searchIndex.entries, searchValue]);

  const selectedProduct = useMemo(() => {
    if (!value) {
      return null;
    }
    return searchIndex.productMap.get(value) ?? null;
  }, [searchIndex.productMap, value]);

  useEffect(() => {
    if (!open) {
      if (!showAddDialog) {
        clearSearch();
        onSearchChange?.('');
      }
    }
  }, [clearSearch, onSearchChange, open, showAddDialog]);

  useEffect(() => {
    if (!open) {
      return;
    }
    onSearchChange?.(debouncedSearchValue.trim());
  }, [debouncedSearchValue, onSearchChange, open]);

  const handleSearchValueChange = useCallback(
    (nextValue: string) => {
      setSearchValue(nextValue);
    },
    [setSearchValue]
  );

  const handleProductSelect = useCallback(
    (productId: string) => {
      onValueChange?.(productId);
      setOpen(false);
      clearSearch();
      onSearchChange?.('');
    },
    [clearSearch, onSearchChange, onValueChange]
  );

  const handleBatchSelect = useCallback(
    (productId: string, batchNumber: string) => {
      onBatchSelect?.(productId, batchNumber);
      setOpen(false);
      clearSearch();
      onSearchChange?.('');
    },
    [clearSearch, onBatchSelect, onSearchChange]
  );

  const handleAddTemporaryProduct = useCallback(() => {
    setShowAddDialog(true);
    setOpen(false);
  }, []);

  const handleTemporaryProductAdded = useCallback(
    (productData: {
      name: string;
      specification?: string;
      weight?: number;
      unit?: string;
    }) => {
      onTemporaryProductAdd?.(productData);
      setShowAddDialog(false);
      clearSearch();
      onSearchChange?.('');
    },
    [clearSearch, onTemporaryProductAdd, onSearchChange]
  );

  const selectedSpecification = useMemo(
    () => formatProductSpecification(selectedProduct?.specification, 40),
    [selectedProduct]
  );

  return {
    open,
    setOpen,
    searchValue,
    handleSearchValueChange,
    showAddDialog,
    setShowAddDialog,
    filteredProducts,
    selectedProduct,
    selectedSpecification,
    handleProductSelect,
    handleBatchSelect,
    handleAddTemporaryProduct,
    handleTemporaryProductAdded,
  };
}

function ProductSearchLoadingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在搜索...
    </div>
  );
}

function ProductSearchEmptyState({
  searchValue,
  isSearching,
  allowTemporaryProducts,
  onAddTemporaryProduct,
}: {
  searchValue: string;
  isSearching: boolean;
  allowTemporaryProducts: boolean;
  onAddTemporaryProduct: () => void;
}) {
  const displayValue =
    searchValue.length > 32 ? `${searchValue.slice(0, 32)}...` : searchValue;

  return (
    <CommandEmpty className="py-6 text-center">
      <div className="space-y-3">
        <div className="text-muted-foreground">
          {isSearching ? (
            '正在搜索商品...'
          ) : searchValue ? (
            <span>
              未找到匹配的商品{' '}
              <mark className="rounded bg-amber-100 px-1 text-amber-900">
                {displayValue}
              </mark>
            </span>
          ) : (
            '请输入关键词搜索商品'
          )}
        </div>
        {allowTemporaryProducts && searchValue && !isSearching && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddTemporaryProduct}
            className="mx-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            添加为临时商品
          </Button>
        )}
      </div>
    </CommandEmpty>
  );
}

function ProductSearchResults({
  products,
  selectedValue,
  onSelectProduct,
  onSelectBatch,
  searchQuery,
}: {
  products: ProductWithInventory[];
  selectedValue?: string;
  onSelectProduct: (productId: string) => void;
  onSelectBatch: (productId: string, batchNumber: string) => void;
  searchQuery: string;
}) {
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

const ProductSearchResultItem = React.memo(
  ({
    product,
    isSelected,
    onSelectProduct,
    onSelectBatch,
    highlightTokens,
  }: {
    product: ProductWithInventory;
    isSelected: boolean;
    onSelectProduct: (productId: string) => void;
    onSelectBatch: (productId: string, batchNumber: string) => void;
    highlightTokens: string[];
  }) => {
    const specification = React.useMemo(
      () => formatProductSpecification(product.specification),
      [product.specification]
    );
    const piecesPerUnit = product.piecesPerUnit ?? 0;
    const availableDisplay = React.useMemo(
      () =>
        formatInventoryQuantity(
          product.inventory?.availableInventory ?? 0,
          piecesPerUnit
        ),
      [product.inventory?.availableInventory, piecesPerUnit]
    );
    const totalDisplay = React.useMemo(
      () =>
        formatInventoryQuantity(
          product.inventory?.totalInventory ?? 0,
          piecesPerUnit
        ),
      [product.inventory?.totalInventory, piecesPerUnit]
    );
    const renderedKeywords = React.useMemo(
      () => buildProductKeywords(product, specification),
      [product, specification]
    );
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
      <CommandItem
        value={renderedKeywords.join(' ')}
        keywords={renderedKeywords}
        onSelect={() => onSelectProduct(product.id)}
        className="flex items-start justify-between gap-4 p-4"
      >
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
                  className="border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-800 shadow-sm"
                >
                  {highlightedCode}
                </Badge>
              )}
              <span className="font-semibold text-gray-900">
                {highlightedName}
              </span>
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
            {piecesPerUnit > 0 && (
              <div className="text-sm text-gray-600">
                每件片数：
                <span className="font-medium text-blue-600">
                  {piecesPerUnit}
                </span>
              </div>
            )}
            {product.inventory?.batches &&
              product.inventory.batches.length > 0 && (
                <ProductBatchList
                  productId={product.id}
                  batches={product.inventory.batches}
                  piecesPerUnit={piecesPerUnit}
                  onSelectBatch={onSelectBatch}
                />
              )}
          </div>
        </div>
        <div className="shrink-0 space-y-1 text-right">
          {product.inventory ? (
            <>
              <div className="rounded-md bg-green-50 px-3 py-1">
                <div className="text-xs text-gray-600">可用库存</div>
                <div className="text-sm font-semibold text-green-600">
                  {availableDisplay}
                </div>
              </div>
              {product.inventory.totalInventory !==
                product.inventory.availableInventory && (
                <div className="text-xs text-gray-500">总量 {totalDisplay}</div>
              )}
            </>
          ) : (
            <div className="rounded-md bg-gray-50 px-3 py-1">
              <div className="text-xs text-gray-500">无库存信息</div>
            </div>
          )}
        </div>
      </CommandItem>
    );
  }
);

ProductSearchResultItem.displayName = 'ProductSearchResultItem';

const ProductBatchList = React.memo(
  ({
    productId,
    batches,
    piecesPerUnit,
    onSelectBatch,
  }: {
    productId: string;
    batches: Array<{ batchNumber: string; quantity: number }>;
    piecesPerUnit: number;
    onSelectBatch: (productId: string, batchNumber: string) => void;
  }) => (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-600">
        点击批次进行选择：
      </div>
      <div className="flex flex-wrap gap-2">
        {batches.map(batch => (
          <button
            key={`${productId}-${batch.batchNumber}`}
            type="button"
            onClick={event => {
              event.stopPropagation();
              onSelectBatch(productId, batch.batchNumber);
            }}
            className="flex items-center gap-1.5 rounded-md border-2 border-blue-200 bg-blue-50 px-3 py-1.5 text-xs transition-all hover:border-blue-400 hover:bg-blue-100 hover:shadow-md active:scale-95"
          >
            <span className="font-mono font-semibold text-blue-700">
              {batch.batchNumber}
            </span>
            <span className="text-gray-400">|</span>
            <span className="font-medium text-green-600">
              {formatInventoryQuantity(batch.quantity, piecesPerUnit)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
);

ProductBatchList.displayName = 'ProductBatchList';

const MAX_SEARCH_RESULTS = 50;

interface ProductSearchIndexEntry {
  product: ProductWithInventory;
  normalized: NormalizedSearchFields;
}

interface NormalizedSearchFields {
  code: string;
  codePinyin: string;
  codeInitials: string;
  name: string;
  namePinyin: string;
  nameInitials: string;
  specification: string;
  specificationPinyin: string;
  specificationInitials: string;
  id: string;
  status?: string;
  availableInventory: number;
}

interface SearchTokenInfo {
  original: string;
  normalized: string;
  pinyin: string;
  initials: string;
}

function buildProductSearchIndex(products: ProductWithInventory[]) {
  const productMap = new Map<string, ProductWithInventory>();
  const entries: ProductSearchIndexEntry[] = products.map(product => {
    productMap.set(product.id, product);
    const specification = formatProductSpecification(product.specification);
    return {
      product,
      normalized: {
        code: (product.code || '').toLowerCase(),
        codePinyin: chineseToPinyinUppercase(product.code || '').toLowerCase(),
        codeInitials: chineseToPinyinInitialsUppercase(
          product.code || ''
        ).toLowerCase(),
        name: (product.name || '').toLowerCase(),
        namePinyin: chineseToPinyinUppercase(product.name || '').toLowerCase(),
        nameInitials: chineseToPinyinInitialsUppercase(
          product.name || ''
        ).toLowerCase(),
        specification: specification.toLowerCase(),
        specificationPinyin:
          chineseToPinyinUppercase(specification).toLowerCase(),
        specificationInitials:
          chineseToPinyinInitialsUppercase(specification).toLowerCase(),
        id: product.id.toLowerCase(),
        status: product.status,
        availableInventory: product.inventory?.availableInventory ?? 0,
      },
    };
  });

  return {
    entries,
    productMap,
  };
}

function searchProducts(
  entries: ProductSearchIndexEntry[],
  query: string
): ProductWithInventory[] {
  const tokens = computeSearchTokens(query);
  if (tokens.length === 0) {
    return [];
  }

  // 提高最小分数阈值，确保只返回真正相关的结果
  // 最低分数2分可以过滤掉大部分不相关的匹配
  const MIN_SCORE = 2;

  return entries
    .map(entry => ({
      product: entry.product,
      score: scoreProduct(entry.normalized, tokens),
      availableInventory: entry.normalized.availableInventory,
    }))
    .filter(result => result.score >= MIN_SCORE)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (b.availableInventory !== a.availableInventory) {
        return b.availableInventory - a.availableInventory;
      }
      return a.product.name.localeCompare(b.product.name, 'zh-CN');
    })
    .slice(0, MAX_SEARCH_RESULTS)
    .map(item => item.product);
}

function computeSearchTokens(query: string): SearchTokenInfo[] {
  return query
    .split(/\s+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean)
    .map(token => {
      const pinyinValue = chineseToPinyinUppercase(token).toLowerCase();
      const initialsValue =
        chineseToPinyinInitialsUppercase(token).toLowerCase();
      return {
        original: token,
        normalized: token,
        pinyin: pinyinValue !== token ? pinyinValue : '',
        initials: initialsValue !== token ? initialsValue : '',
      };
    });
}

function scoreProduct(
  fields: NormalizedSearchFields,
  tokens: SearchTokenInfo[]
): number {
  let score = 0;

  tokens.forEach(token => {
    // 主要搜索字段：编码和名称（高权重）
    score += matchText(fields.code, token.normalized, {
      exact: 18,
      prefix: 9,
      contains: 6,
    });
    score += matchText(fields.name, token.normalized, {
      exact: 14,
      prefix: 7,
      contains: 4,
    });

    // 次要搜索字段：规格（中等权重）
    score += matchText(fields.specification, token.normalized, {
      exact: 8,
      prefix: 4,
      contains: 2,
    });

    // 移除ID字段匹配 - UUID不应该被搜索
    // score += matchText(fields.id, token.normalized, { ... });

    if (token.pinyin) {
      score += matchText(fields.namePinyin, token.pinyin, {
        exact: 6,
        prefix: 3,
        contains: 1.5,
      });
      score += matchText(fields.specificationPinyin, token.pinyin, {
        exact: 4,
        prefix: 2,
        contains: 1,
      });
      score += matchText(fields.codePinyin, token.pinyin, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
    }

    if (token.initials) {
      score += matchText(fields.nameInitials, token.initials, {
        exact: 8,
        prefix: 4,
        contains: 2,
      });
      score += matchText(fields.specificationInitials, token.initials, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
      score += matchText(fields.codeInitials, token.initials, {
        exact: 5,
        prefix: 2.5,
        contains: 1,
      });
    }
  });

  if (fields.status === 'active') {
    score += 0.5;
  } else if (fields.status === 'inactive') {
    score -= 0.5;
  }

  if (fields.availableInventory > 0) {
    score += Math.min(fields.availableInventory / 100, 1);
  }

  return score;
}

interface MatchWeights {
  exact: number;
  prefix: number;
  contains: number;
}

function matchText(text: string, token: string, weights: MatchWeights) {
  if (!text || !token) {
    return 0;
  }

  if (text === token) {
    return weights.exact;
  }
  if (text.startsWith(token)) {
    return weights.prefix;
  }
  if (text.includes(token)) {
    return weights.contains;
  }
  return 0;
}

function buildHighlightTokens(query: string): string[] {
  if (!query) {
    return [];
  }

  const tokens = Array.from(
    new Set(
      query
        .split(/\s+/)
        .map(token => token.trim())
        .filter(Boolean)
    )
  );

  return tokens.sort((a, b) => b.length - a.length);
}

function renderHighlightedText(
  text: string | undefined,
  tokens: string[]
): React.ReactNode {
  if (!text || tokens.length === 0) {
    return text ?? null;
  }

  const pattern = new RegExp(
    `(${tokens.map(token => escapeRegExp(token)).join('|')})`,
    'ig'
  );

  const segments = text.split(pattern).filter(segment => segment.length > 0);

  return segments.map((segment, index) => {
    const isMatch = tokens.some(
      token => segment.toLowerCase() === token.toLowerCase()
    );

    if (isMatch) {
      return (
        <mark
          key={`highlight-${segment}-${index}`}
          className="rounded bg-amber-100 px-0.5 text-amber-900"
        >
          {segment}
        </mark>
      );
    }

    return (
      <React.Fragment key={`segment-${segment}-${index}`}>
        {segment}
      </React.Fragment>
    );
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatProductSpecification(spec?: string | null, truncateTo?: number) {
  const formatted =
    ProductDataUtils.formatter.formatSpecification(spec ?? '') || '';
  const sanitized = formatted.trim();

  if (
    !sanitized ||
    sanitized === '-' ||
    sanitized.toLowerCase() === '规格详情'
  ) {
    return '';
  }

  if (truncateTo && sanitized.length > truncateTo) {
    return `${sanitized.slice(0, truncateTo)}...`;
  }

  return sanitized;
}

function formatInventoryQuantity(quantity: number, piecesPerUnit: number) {
  return formatPieceSummary(quantity, piecesPerUnit, {
    fallbackUnit: '片',
    zeroDisplay: '0片',
  });
}

function buildProductKeywords(
  product: ProductWithInventory,
  specification: string
) {
  return [product.code, product.name, specification, product.id].filter(
    (token): token is string => Boolean(token)
  );
}

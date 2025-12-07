import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebouncedSearch } from '@/hooks/use-debounced-search';

import type { ProductWithInventory, SmartProductSearchProps } from '../types';
import {
  buildProductSearchIndex,
  formatProductSpecification,
  searchProducts,
} from '../utils/product-search';

export function useSmartProductSearchController({
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
    searchValue,
    setSearchValue,
    clearSearch,
    filteredProducts,
    selectedProduct,
    debouncedSearchValue,
  } = useProductSearchState(products, value);

  useSearchLifecycle({
    open,
    showAddDialog,
    onSearchChange,
    clearSearch,
    debouncedSearchValue,
    selectedProduct,
    setSearchValue,
  });

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
      productCode?: string;
      name: string;
      specification?: string;
      weight?: number;
      unit?: string;
      piecesPerUnit?: number;
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

interface UseSearchLifecycleParams {
  open: boolean;
  showAddDialog: boolean;
  onSearchChange?: (value: string) => void;
  clearSearch: () => void;
  debouncedSearchValue: string;
  selectedProduct: ProductWithInventory | null;
  setSearchValue: (value: string) => void;
}

function useSearchLifecycle({
  open,
  showAddDialog,
  onSearchChange,
  clearSearch,
  debouncedSearchValue,
  selectedProduct,
  setSearchValue,
}: UseSearchLifecycleParams) {
  const previousOpen = usePrevious(open);
  const selectedProductPrefill = useMemo(
    () => selectedProduct?.code || selectedProduct?.name || '',
    [selectedProduct?.code, selectedProduct?.name]
  );

  // 使用 ref 跟踪是否已经为当前选中的产品填充过搜索值
  const lastPrefilledProduct = useRef<string>('');

  // 打开时自动填充已选产品编码
  useEffect(() => {
    const wasOpen = previousOpen ?? false;

    if (open && !wasOpen) {
      // 打开时填充已选产品（仅当产品变化时才填充）
      if (
        selectedProductPrefill &&
        lastPrefilledProduct.current !== selectedProductPrefill
      ) {
        // 使用 requestAnimationFrame 确保在浏览器下一帧渲染时填充
        // 这样可以避免在 Popover 打开动画期间触发重新渲染
        const rafId = requestAnimationFrame(() => {
          setSearchValue(selectedProductPrefill);
          lastPrefilledProduct.current = selectedProductPrefill;
        });
        return () => cancelAnimationFrame(rafId);
      }
      return;
    }

    if (!open && wasOpen && !showAddDialog) {
      // 关闭时清空搜索
      clearSearch();
      onSearchChange?.('');
    }

    // 显式返回 undefined，满足 noImplicitReturns 要求
    return undefined;
  }, [
    open,
    previousOpen,
    selectedProductPrefill,
    showAddDialog,
    setSearchValue,
    clearSearch,
    onSearchChange,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    onSearchChange?.(debouncedSearchValue.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, debouncedSearchValue]);
}

function usePrevious<T>(value: T) {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

interface ProductSearchState {
  searchValue: string;
  setSearchValue: (value: string) => void;
  clearSearch: () => void;
  filteredProducts: ProductWithInventory[];
  selectedProduct: ProductWithInventory | null;
  debouncedSearchValue: string;
}

function useProductSearchState(
  products: ProductWithInventory[],
  selectedId?: string
): ProductSearchState {
  const {
    inputValue: searchValue,
    debouncedValue: debouncedSearchValue,
    setInputValue,
    clearSearch,
  } = useDebouncedSearch({ delay: 250 });

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
    if (!selectedId) {
      return null;
    }
    return searchIndex.productMap.get(selectedId) ?? null;
  }, [searchIndex.productMap, selectedId]);

  return {
    searchValue,
    setSearchValue: setInputValue,
    clearSearch,
    filteredProducts,
    selectedProduct,
    debouncedSearchValue,
  };
}

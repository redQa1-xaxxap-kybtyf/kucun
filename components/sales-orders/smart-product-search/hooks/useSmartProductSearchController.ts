import { useCallback, useEffect, useMemo, useState } from 'react';

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
  // 打开时自动填充已选商品编码
  useEffect(() => {
    if (open && selectedProduct) {
      // 优先使用商品编码，其次使用名称
      setSearchValue(selectedProduct.code || selectedProduct.name || '');
    } else if (!open && !showAddDialog) {
      // 关闭时清空搜索框
      clearSearch();
      onSearchChange?.('');
    }
  }, [
    open,
    showAddDialog,
    clearSearch,
    onSearchChange,
    selectedProduct,
    setSearchValue,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }
    onSearchChange?.(debouncedSearchValue.trim());
  }, [open, debouncedSearchValue, onSearchChange]);
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

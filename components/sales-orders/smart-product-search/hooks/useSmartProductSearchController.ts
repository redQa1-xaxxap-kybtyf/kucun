import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  isPinyinSearchQuery,
  loadPinyinUtils,
  type PinyinUtils,
} from '@/lib/utils/pinyin-loader';

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
  const searchChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const {
    searchValue,
    setSearchValue,
    clearSearch,
    filteredProducts,
    selectedProduct,
  } = useProductSearchState(products, value);

  const clearScheduledSearchChange = useCallback(() => {
    if (searchChangeTimeoutRef.current) {
      clearTimeout(searchChangeTimeoutRef.current);
      searchChangeTimeoutRef.current = null;
    }
  }, []);

  const scheduleSearchChange = useCallback(
    (nextValue: string) => {
      if (!onSearchChange) {
        return;
      }

      clearScheduledSearchChange();
      searchChangeTimeoutRef.current = setTimeout(() => {
        onSearchChange(nextValue.trim());
        searchChangeTimeoutRef.current = null;
      }, 250);
    },
    [clearScheduledSearchChange, onSearchChange]
  );

  useSearchLifecycle({
    open,
    showAddDialog,
    onSearchChange,
    clearSearch,
    selectedProduct,
    setSearchValue,
    clearScheduledSearchChange,
  });

  const handleSearchValueChange = useCallback(
    (nextValue: string) => {
      setSearchValue(nextValue);
      scheduleSearchChange(nextValue);
    },
    [scheduleSearchChange, setSearchValue]
  );

  const handleProductSelect = useCallback(
    (productId: string) => {
      onValueChange?.(productId);
      setOpen(false);
      clearScheduledSearchChange();
      clearSearch();
    },
    [clearScheduledSearchChange, clearSearch, onValueChange]
  );

  const handleBatchSelect = useCallback(
    (productId: string, batchNumber: string) => {
      onBatchSelect?.(productId, batchNumber);
      setOpen(false);
      clearScheduledSearchChange();
      clearSearch();
    },
    [clearScheduledSearchChange, clearSearch, onBatchSelect]
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
      clearScheduledSearchChange();
      clearSearch();
      onSearchChange?.('');
    },
    [
      clearScheduledSearchChange,
      clearSearch,
      onTemporaryProductAdd,
      onSearchChange,
    ]
  );

  useEffect(
    () => () => {
      clearScheduledSearchChange();
    },
    [clearScheduledSearchChange]
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
  selectedProduct: ProductWithInventory | null;
  setSearchValue: (value: string) => void;
  clearScheduledSearchChange: () => void;
}

function useSearchLifecycle({
  open,
  showAddDialog,
  onSearchChange,
  clearSearch,
  selectedProduct,
  setSearchValue,
  clearScheduledSearchChange,
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
      clearScheduledSearchChange();
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
    clearScheduledSearchChange,
    onSearchChange,
  ]);
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
}

function useProductSearchState(
  products: ProductWithInventory[],
  selectedId?: string
): ProductSearchState {
  const [searchValue, setSearchValue] = useState('');
  const clearSearch = useCallback(() => {
    setSearchValue('');
  }, []);

  const [pinyinUtils, setPinyinUtils] = useState<PinyinUtils | null>(null);
  const needsPinyin = useMemo(() => isPinyinSearchQuery(searchValue), [searchValue]);

  useEffect(() => {
    if (!needsPinyin || pinyinUtils) {
      return;
    }

    let cancelled = false;

    loadPinyinUtils()
      .then(utils => {
        if (cancelled) {
          return;
        }
        setPinyinUtils(utils);
      })
      .catch(() => {
        // 拼音库加载失败时，降级为基础搜索（不影响业务正确性）
      });

    return () => {
      cancelled = true;
    };
  }, [needsPinyin, pinyinUtils]);

  const searchIndex = useMemo(
    () => buildProductSearchIndex(products, needsPinyin ? pinyinUtils ?? undefined : undefined),
    [products, needsPinyin, pinyinUtils]
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
    setSearchValue,
    clearSearch,
    filteredProducts,
    selectedProduct,
  };
}

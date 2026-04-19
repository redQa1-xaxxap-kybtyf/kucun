'use client';

import { useCallback, useEffect, useState } from 'react';

import { useListSearchController } from '@/hooks/use-list-search-controller';
import { useProductSearch } from '@/lib/api/inbound';
import type { ProductOption } from '@/lib/types/inbound';
import { logger } from '@/lib/utils/console-logger';

export function useProductSelector(
  value: string,
  onChange: (value: string, product?: ProductOption) => void
) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const {
    searchInput,
    isSearching,
    handleSearchChange: handleDebouncedSearchChange,
    cancelPendingCommit,
    clearSearch,
  } = useListSearchController({
    committedValue: searchQuery,
    onCommit: query => {
      setSearchQuery(query ?? '');
    },
  });

  // 搜索产品
  const {
    data: products = [],
    isLoading,
    error,
  } = useProductSearch(searchQuery);

  // 当value变化时，更新选中的产品
  useEffect(() => {
    if (value && products.length > 0) {
      const product = products.find(p => p.value === value);
      if (product) {
        setSelectedProduct(product);
      }
    } else if (!value) {
      setSelectedProduct(null);
    }
  }, [value, products]);

  // 处理搜索输入
  const handleSearchChange = useCallback(
    (query: string) => {
      if (query.trim().length > 0) {
        setOpen(true);
      }
      handleDebouncedSearchChange(query);
    },
    [handleDebouncedSearchChange]
  );

  // 处理产品选择
  const handleSelect = useCallback((product: ProductOption) => {
    cancelPendingCommit();
    setSelectedProduct(product);

    // 确保 onChange 被调用
    try {
      onChange(product.value, product);
    } catch (error) {
      logger.error(
        'hooks:use-product-selector',
        '产品选择回调执行失败',
        error
      );
    }

    setOpen(false);
    setSearchQuery('');
    clearSearch();
  }, [cancelPendingCommit, clearSearch, onChange]);

  // 清除选择
  const handleClear = useCallback(() => {
    cancelPendingCommit();
    setSelectedProduct(null);
    onChange('', undefined);
    setSearchQuery('');
    clearSearch();
  }, [cancelPendingCommit, clearSearch, onChange]);

  // 处理命令项选择
  const handleCommandSelect = useCallback((commandValue: string) => {
    // 直接根据commandValue查找产品
    // CommandItem的value格式为: `${product.code}-${product.value}`
    // 由于产品编码可能包含'-',不能简单split,应该直接从products列表中查找
    const selectedProductItem = products.find(
      p => `${p.code}-${p.value}` === commandValue
    );

    if (selectedProductItem) {
      handleSelect(selectedProductItem);
    } else {
      logger.warn(
        'hooks:use-product-selector',
        '未找到匹配的产品',
        commandValue,
        products
      );
    }
  }, [handleSelect, products]);

  return {
    open,
    setOpen,
    searchInput,
    searchQuery,
    selectedProduct,
    products,
    isLoading: isLoading || isSearching,
    error,
    handleSearchChange,
    handleSelect,
    handleClear,
    handleCommandSelect,
  };
}

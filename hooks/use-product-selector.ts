'use client';

import { useEffect, useRef, useState } from 'react';

import { useProductSearch } from '@/lib/api/inbound';
import type { ProductOption } from '@/lib/types/inbound';

export function useProductSelector(
  value: string,
  onChange: (value: string, product?: ProductOption) => void
) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(
    null
  );
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

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
    }
  }, [value, products]);

  // 处理搜索输入
  const handleSearchChange = (query: string) => {
    // 清除之前的定时器
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // 设置新的定时器，防抖处理
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
    }, 300);
  };

  // 处理产品选择
  const handleSelect = (product: ProductOption) => {
    setSelectedProduct(product);

    // 确保 onChange 被调用
    try {
      onChange(product.value, product);
    } catch (error) {
      console.error('[useProductSelector] 产品选择回调执行失败', error);
    }

    setOpen(false);
  };

  // 清除选择
  const handleClear = () => {
    setSelectedProduct(null);
    onChange('', undefined);
    setSearchQuery('');
  };

  // 处理命令项选择
  const handleCommandSelect = (commandValue: string) => {
    // 直接根据commandValue查找产品
    // CommandItem的value格式为: `${product.code}-${product.value}`
    // 由于产品编码可能包含'-',不能简单split,应该直接从products列表中查找
    const selectedProductItem = products.find(
      p => `${p.code}-${p.value}` === commandValue
    );

    if (selectedProductItem) {
      handleSelect(selectedProductItem);
    } else {
      console.warn(
        '[useProductSelector] 未找到匹配的产品',
        commandValue,
        products
      );
    }
  };

  // 组件卸载时清理搜索定时器，避免内存泄漏
  useEffect(
    () => () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    },
    []
  );

  return {
    open,
    setOpen,
    searchQuery,
    selectedProduct,
    products,
    isLoading,
    error,
    handleSearchChange,
    handleSelect,
    handleClear,
    handleCommandSelect,
  };
}

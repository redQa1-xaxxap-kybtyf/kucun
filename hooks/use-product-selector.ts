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
      // 静默处理错误，避免console输出
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
    // 从 value 中提取产品ID（格式：CODE-ID）
    const productId = commandValue.split('-').slice(1).join('-');
    const selectedProductItem = products.find(p => p.value === productId);

    if (selectedProductItem) {
      handleSelect(selectedProductItem);
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

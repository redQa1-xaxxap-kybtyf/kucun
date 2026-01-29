import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Supplier } from '@/lib/types/supplier';
import {
  isPinyinSearchQuery,
  loadPinyinUtils,
  type PinyinUtils,
} from '@/lib/utils/pinyin-loader';

import type {
  SupplierSelectorController,
  SupplierSelectorProps,
} from '../types';
import { filterSuppliers } from '../utils/supplier-search';

export function useSupplierSelectorController(
  props: SupplierSelectorProps
): SupplierSelectorController {
  const {
    suppliers,
    value,
    onValueChange,
    onSupplierCreated,
    onRefreshSuppliers,
  } = props;

  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const wasOpenRef = useRef(false);

  const [pinyinUtils, setPinyinUtils] = useState<PinyinUtils | null>(null);

  const shouldLoadPinyin = open && isPinyinSearchQuery(searchValue);

  useEffect(() => {
    if (!shouldLoadPinyin || pinyinUtils) {
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
  }, [pinyinUtils, shouldLoadPinyin]);

  const filteredSuppliers = useMemo(
    () => filterSuppliers(suppliers, searchValue, pinyinUtils ?? undefined),
    [suppliers, searchValue, pinyinUtils]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find(supplier => supplier.id === value) ?? null,
    [suppliers, value]
  );

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      onRefreshSuppliers?.();
    }
    wasOpenRef.current = open;
  }, [open, onRefreshSuppliers]);

  const handleSearchValueChange = useCallback((nextValue: string) => {
    setSearchValue(nextValue);
  }, []);

  const handleSelect = useCallback(
    (supplierId: string) => {
      onValueChange?.(supplierId);
      setOpen(false);
      setSearchValue('');
    },
    [onValueChange]
  );

  const handleSupplierCreated = useCallback(
    (supplier: Supplier) => {
      onSupplierCreated?.(supplier);
      onValueChange?.(supplier.id);
      setCreateDialogOpen(false);
      setSearchValue('');
    },
    [onSupplierCreated, onValueChange]
  );

  const handleOpenCreateDialog = useCallback(() => {
    setCreateDialogOpen(true);
    setOpen(false);
  }, []);

  return {
    open,
    setOpen,
    searchValue,
    handleSearchValueChange,
    filteredSuppliers,
    selectedSupplier,
    createDialogOpen,
    setCreateDialogOpen,
    handleSelect,
    handleSupplierCreated,
    handleOpenCreateDialog,
  };
}

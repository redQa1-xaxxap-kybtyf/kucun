import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Supplier } from '@/lib/types/supplier';

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

  const filteredSuppliers = useMemo(
    () => filterSuppliers(suppliers, searchValue),
    [suppliers, searchValue]
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

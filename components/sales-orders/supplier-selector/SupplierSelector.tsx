'use client';

import React from 'react';
import { ZodError } from 'zod';

import { QuickAddSupplierDialog } from '@/components/suppliers/quick-add-supplier-dialog';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { SupplierSearchEmptyState } from './components/SupplierSearchEmptyState';
import { SupplierSearchLoadingIndicator } from './components/SupplierSearchLoadingIndicator';
import { SupplierSearchResults } from './components/SupplierSearchResults';
import { SupplierSelectorTrigger } from './components/SupplierSelectorTrigger';
import { useSupplierSelectorController } from './hooks/useSupplierSelectorController';
import type { SupplierSelectorProps } from './types';

export function SupplierSelector(props: SupplierSelectorProps) {
  const {
    open,
    setOpen: setPopoverOpen,
    searchValue,
    handleSearchValueChange,
    filteredSuppliers,
    selectedSupplier,
    createDialogOpen,
    setCreateDialogOpen,
    handleSelect,
    handleSupplierCreated,
    handleOpenCreateDialog,
  } = useSupplierSelectorController(props);

  const {
    placeholder = '搜索并选择供应商',
    disabled = false,
    className,
    isLoading = false,
    onBlur,
  } = props;

  const trimmedSearchValue = searchValue.trim();
  const hasResults = filteredSuppliers.length > 0;

  const notifyBlur = React.useCallback(() => {
    if (!onBlur) {
      return;
    }

    const handleError = (error: unknown) => {
      if (error instanceof ZodError) {
        return;
      }
      console.error('supplier-selector:onBlur failed', error);
    };

    try {
      // ✅ 调用onBlur,可能返回void或Promise<void>
      const result = onBlur();
      // ✅ 检查是否为Promise,如果是则添加错误处理
      if (
        result !== undefined &&
        typeof (result as Promise<unknown>).catch === 'function'
      ) {
        (result as Promise<unknown>).catch(handleError);
      }
    } catch (error) {
      handleError(error);
    }
  }, [onBlur]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      setPopoverOpen(nextOpen);
      if (!nextOpen) {
        notifyBlur();
      }
    },
    [setPopoverOpen, notifyBlur]
  );

  const handleSelectWithBlur = React.useCallback(
    (supplierId: string) => {
      handleSelect(supplierId);
      notifyBlur();
    },
    [handleSelect, notifyBlur]
  );

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <SupplierSelectorTrigger
            selectedSupplier={selectedSupplier}
            placeholder={placeholder}
            isLoading={isLoading}
            disabled={disabled || isLoading}
            className={className}
            open={open}
            onBlur={notifyBlur}
          />
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="搜索供应商名称或手机号..."
              value={searchValue}
              onValueChange={handleSearchValueChange}
            />
            <CommandList>
              {isLoading && <SupplierSearchLoadingIndicator />}
              {hasResults ? (
                <SupplierSearchResults
                  suppliers={filteredSuppliers}
                  selectedValue={props.value}
                  onSelect={handleSelectWithBlur}
                />
              ) : (
                <CommandEmpty>
                  <SupplierSearchEmptyState
                    searchValue={trimmedSearchValue}
                    isLoading={isLoading}
                    onAddSupplier={handleOpenCreateDialog}
                  />
                </CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <QuickAddSupplierDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSupplierCreated={handleSupplierCreated}
        initialName={searchValue}
      />
    </>
  );
}

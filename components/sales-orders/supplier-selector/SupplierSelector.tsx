'use client';

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
  } = useSupplierSelectorController(props);

  const {
    placeholder = '搜索并选择供应商',
    disabled = false,
    className,
    isLoading = false,
  } = props;

  const trimmedSearchValue = searchValue.trim();
  const hasResults = filteredSuppliers.length > 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <SupplierSelectorTrigger
            selectedSupplier={selectedSupplier}
            placeholder={placeholder}
            isLoading={isLoading}
            disabled={disabled || isLoading}
            className={className}
            open={open}
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
                  onSelect={handleSelect}
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

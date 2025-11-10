import type { Supplier } from '@/lib/types/supplier';

export interface SupplierSelectorProps {
  suppliers: Supplier[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isLoading?: boolean;
  onSupplierCreated?: (supplier: Supplier) => void;
  onRefreshSuppliers?: () => void;
  onBlur?: () => void;
}

export interface SupplierSelectorController {
  open: boolean;
  setOpen: (open: boolean) => void;
  searchValue: string;
  handleSearchValueChange: (value: string) => void;
  filteredSuppliers: Supplier[];
  selectedSupplier: Supplier | null;
  createDialogOpen: boolean;
  setCreateDialogOpen: (open: boolean) => void;
  handleSelect: (supplierId: string) => void;
  handleSupplierCreated: (supplier: Supplier) => void;
  handleOpenCreateDialog: () => void;
}

import type { ProductBatchSpec } from '@/lib/types/product';

export interface ProductWithInventory {
  id: string;
  code: string;
  name: string;
  specification?: string | null;
  unit: string;
  piecesPerUnit?: number | null;
  weight?: number | null;
  status?: string;
  batchSpecs?: ProductBatchSpec[];
  inventory?: {
    totalInventory: number;
    availableInventory: number;
    reservedInventory: number;
    batches?: Array<{
      batchNumber: string;
      quantity: number;
      piecesPerUnit?: number | null;
      weight?: number | null;
    }>;
  } | null;
}

export interface TemporaryProductRequirements {
  requireCode?: boolean;
  requireName?: boolean;
}

export interface SmartProductSearchProps {
  products: ProductWithInventory[];
  value?: string;
  onValueChange?: (value: string) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
  onTemporaryProductAdd?: (productData: {
    productCode?: string;
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
    piecesPerUnit?: number;
  }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowTemporaryProducts?: boolean;
  onSearchChange?: (query: string) => void;
  isSearching?: boolean;
  simple?: boolean;
  temporaryProductRequirements?: TemporaryProductRequirements;
  onBlur?: () => void | Promise<void>; // ✅ 支持同步和异步onBlur
}

import type { Product } from '@/lib/types/product';

export type ProductSelectorVariant = 'default' | 'enhanced' | 'compact';
export type ProductSelectorMode = 'single' | 'multiple';
export type DataSourceType = 'api' | 'props';
export type CodePosition = 'left' | 'top';

export interface InventoryConfig {
  show: boolean;
  allowZeroStock?: boolean;
  lowStockThreshold?: number;
}

export interface DisplayConfig {
  showCode?: boolean;
  codePosition?: CodePosition;
  showSpecification?: boolean;
  showPrice?: boolean;
  showUnit?: boolean;
  customHint?: string;
}

export interface ApiQueryConfig {
  enableCache?: boolean;
  staleTime?: number;
  debounceDelay?: number;
  limit?: number;
  statusFilter?: 'active' | 'inactive' | 'all';
  includeInventory?: boolean;
}

export interface ProductSelectorConfig {
  variant?: ProductSelectorVariant;
  mode?: ProductSelectorMode;
  inventory?: InventoryConfig;
  display?: DisplayConfig;
  apiQuery?: ApiQueryConfig;
}

export interface BaseProductSelectorProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  error?: boolean;
  config?: ProductSelectorConfig;
}

export interface SingleSelectProps extends BaseProductSelectorProps {
  mode?: 'single';
  value?: string;
  onValueChange: (value: string) => void;
  onProductChange?: (product: Product | null) => void;
}

export interface MultiSelectProps extends BaseProductSelectorProps {
  mode: 'multiple';
  value: string[];
  onValueChange: (value: string[]) => void;
  onProductsChange?: (products: Product[]) => void;
  maxSelection?: number;
}

export interface ApiDataSourceProps {
  dataSource?: 'api';
  products?: never;
}

export interface PropsDataSourceProps {
  dataSource: 'props';
  products: Product[];
}

export type SingleApiProductSelectorProps = SingleSelectProps &
  ApiDataSourceProps;
export type SinglePropsProductSelectorProps = SingleSelectProps &
  PropsDataSourceProps;
export type MultiApiProductSelectorProps = MultiSelectProps &
  ApiDataSourceProps;
export type MultiPropsProductSelectorProps = MultiSelectProps &
  PropsDataSourceProps;

export type UnifiedProductSelectorProps =
  | SingleApiProductSelectorProps
  | SinglePropsProductSelectorProps
  | MultiApiProductSelectorProps
  | MultiPropsProductSelectorProps;

export const DEFAULT_CONFIG: Required<ProductSelectorConfig> = {
  variant: 'default',
  mode: 'single',
  inventory: {
    show: false,
    allowZeroStock: true,
    lowStockThreshold: 10,
  },
  display: {
    showCode: true,
    codePosition: 'left',
    showSpecification: true,
    showPrice: false,
    showUnit: true,
    customHint: undefined,
  },
  apiQuery: {
    enableCache: true,
    staleTime: 5 * 60 * 1000,
    debounceDelay: 250,
    limit: 50,
    statusFilter: 'active',
    includeInventory: false,
  },
};

export const PRESET_CONFIGS = {
  inventory: {
    variant: 'default',
    inventory: {
      show: true,
      allowZeroStock: false,
      lowStockThreshold: 10,
    },
    display: {
      showCode: true,
      codePosition: 'left',
      showSpecification: true,
      showPrice: false,
    },
    apiQuery: {
      includeInventory: true,
    },
  } satisfies ProductSelectorConfig,
  salesOrder: {
    variant: 'enhanced',
    inventory: {
      show: true,
      allowZeroStock: false,
      lowStockThreshold: 5,
    },
    display: {
      showCode: true,
      codePosition: 'top',
      showSpecification: true,
      showPrice: true,
    },
    apiQuery: {
      includeInventory: true,
    },
  } satisfies ProductSelectorConfig,
  transfer: {
    variant: 'enhanced',
    inventory: {
      show: true,
      allowZeroStock: true,
      lowStockThreshold: 0,
    },
    display: {
      showCode: true,
      codePosition: 'top',
      showSpecification: true,
      showPrice: true,
      customHint: '调货销售：可选择零库存产品',
    },
    apiQuery: {
      includeInventory: true,
    },
  } satisfies ProductSelectorConfig,
  compact: {
    variant: 'compact',
    display: {
      showCode: true,
      codePosition: 'left',
      showSpecification: false,
      showPrice: false,
    },
  } satisfies ProductSelectorConfig,
} as const;

'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { getProducts, productQueryKeys } from '@/lib/api/products';
import type { Product } from '@/lib/types/product';
import type {
  ApiQueryConfig,
  DataSourceType,
  ProductSelectorConfig,
  ProductSelectorMode,
} from '@/lib/types/unified-product-selector';

interface UseProductSelectorDataParams {
  dataSource: DataSourceType;
  products?: Product[];
  apiConfig: ProductSelectorConfig['apiQuery'];
  mode: ProductSelectorMode;
  value: string | string[];
  open: boolean;
}

interface UseProductSelectorDataResult {
  products: Product[];
  totalCount: number;
  selectedProduct: Product | null;
  selectedProducts: Product[];
  searchValue: string;
  setSearchValue: (value: string) => void;
  isLoading: boolean;
}

function normalizeStatusFilter(
  status: ApiQueryConfig['statusFilter']
): 'active' | 'inactive' | undefined {
  if (!status || status === 'all') {
    return undefined;
  }
  return status;
}

function useApiProducts({
  enabled,
  apiConfig,
  debouncedValue,
}: {
  enabled: boolean;
  apiConfig: ProductSelectorConfig['apiQuery'];
  debouncedValue: string;
}) {
  return useQuery({
    queryKey: productQueryKeys.list({
      search: debouncedValue || undefined,
      limit: apiConfig?.limit,
      status: normalizeStatusFilter(apiConfig?.statusFilter),
      includeInventory: apiConfig?.includeInventory,
    }),
    queryFn: () =>
      getProducts({
        search: debouncedValue || undefined,
        limit: apiConfig?.limit,
        status: normalizeStatusFilter(apiConfig?.statusFilter),
        includeInventory: apiConfig?.includeInventory,
      }),
    enabled,
    staleTime: apiConfig?.enableCache
      ? (apiConfig?.staleTime ?? 5 * 60 * 1000)
      : 0,
    gcTime: apiConfig?.enableCache
      ? (apiConfig?.staleTime ?? 5 * 60 * 1000)
      : 0,
    refetchOnWindowFocus: false,
  });
}

export function useProductSelectorData({
  dataSource,
  products: propsProducts,
  apiConfig,
  mode,
  value,
  open,
}: UseProductSelectorDataParams): UseProductSelectorDataResult {
  const shouldFetchFromApi = dataSource === 'api';
  const {
    inputValue: searchValue,
    debouncedValue,
    setInputValue,
    clearSearch,
  } = useDebouncedSearch({
    delay: apiConfig?.debounceDelay ?? 250,
    minLength: 0,
  });

  const { data: apiResponse, isLoading: isApiLoading } = useApiProducts({
    enabled: shouldFetchFromApi && open,
    apiConfig,
    debouncedValue,
  });

  const baseProducts = useMemo(() => {
    if (shouldFetchFromApi) {
      return apiResponse?.data ?? [];
    }
    return propsProducts ?? [];
  }, [apiResponse?.data, propsProducts, shouldFetchFromApi]);

  const uniqueProducts = useMemo(
    () => buildUniqueProducts(baseProducts, propsProducts, mode, value),
    [baseProducts, mode, propsProducts, value]
  );

  const selectedProduct = useMemo(
    () => deriveSelectedProduct(uniqueProducts, mode, value),
    [mode, uniqueProducts, value]
  );

  const selectedProducts = useMemo(
    () => deriveSelectedProducts(uniqueProducts, mode, value),
    [mode, uniqueProducts, value]
  );

  const totalCount = useMemo(() => {
    if (shouldFetchFromApi) {
      return apiResponse?.pagination?.total ?? uniqueProducts.length;
    }
    return propsProducts?.length ?? uniqueProducts.length;
  }, [
    apiResponse?.pagination?.total,
    propsProducts,
    shouldFetchFromApi,
    uniqueProducts,
  ]);

  useEffect(() => {
    if (!open) {
      clearSearch();
    }
  }, [clearSearch, open]);

  return {
    products: uniqueProducts,
    totalCount,
    selectedProduct,
    selectedProducts,
    searchValue,
    setSearchValue: setInputValue,
    isLoading: shouldFetchFromApi ? isApiLoading : false,
  };
}

interface UseProductSelectionParams {
  mode: ProductSelectorMode;
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
  onProductChange?: (product: Product | null) => void;
  onProductsChange?: (products: Product[]) => void;
  maxSelection?: number;
  setOpen: (open: boolean) => void;
  setSearchValue: (value: string) => void;
  products: Product[];
}

interface UseProductSelectionResult {
  handleSelect: (productId: string) => void;
  handleClear: () => void;
  handleRemove: (productId: string) => void;
}

export function useProductSelection({
  mode,
  value,
  onValueChange,
  onProductChange,
  onProductsChange,
  maxSelection,
  setOpen,
  setSearchValue,
  products,
}: UseProductSelectionParams): UseProductSelectionResult {
  const productMap = useMemo(
    () => new Map(products.map(product => [product.id, product])),
    [products]
  );

  const handleSelect = useCallback(
    (productId: string) => {
      if (mode === 'single') {
        onValueChange(productId);
        onProductChange?.(productMap.get(productId) ?? null);
        setOpen(false);
        setSearchValue('');
        return;
      }

      const currentValue = Array.isArray(value) ? value : [];
      const alreadySelected = currentValue.includes(productId);

      if (alreadySelected) {
        const nextSelection = currentValue.filter(id => id !== productId);
        onValueChange(nextSelection);
        if (onProductsChange) {
          onProductsChange(
            nextSelection
              .map(id => productMap.get(id))
              .filter((product): product is Product => Boolean(product))
          );
        }
        return;
      }

      if (maxSelection && currentValue.length >= maxSelection) {
        return;
      }

      const nextSelection = [...currentValue, productId];
      onValueChange(nextSelection);
      if (onProductsChange) {
        onProductsChange(
          nextSelection
            .map(id => productMap.get(id))
            .filter((product): product is Product => Boolean(product))
        );
      }
      setSearchValue('');
    },
    [
      maxSelection,
      mode,
      onProductChange,
      onProductsChange,
      onValueChange,
      productMap,
      setOpen,
      setSearchValue,
      value,
    ]
  );

  const handleClear = useCallback(() => {
    if (mode === 'single') {
      onValueChange('');
      onProductChange?.(null);
    } else {
      onValueChange([]);
      onProductsChange?.([]);
    }
    setSearchValue('');
  }, [mode, onProductChange, onProductsChange, onValueChange, setSearchValue]);

  const handleRemove = useCallback(
    (productId: string) => {
      if (mode === 'single') {
        handleClear();
        return;
      }

      const currentValue = Array.isArray(value) ? value : [];
      const nextSelection = currentValue.filter(id => id !== productId);
      onValueChange(nextSelection);
      if (onProductsChange) {
        onProductsChange(
          nextSelection
            .map(id => productMap.get(id))
            .filter((product): product is Product => Boolean(product))
        );
      }
    },
    [handleClear, mode, onProductsChange, onValueChange, productMap, value]
  );

  return {
    handleSelect,
    handleClear,
    handleRemove,
  };
}

function buildUniqueProducts(
  baseProducts: Product[],
  propsProducts: Product[] | undefined,
  mode: ProductSelectorMode,
  value: string | string[]
): Product[] {
  const map = new Map<string, Product>();

  baseProducts.forEach(product => {
    map.set(product.id, product);
  });

  (propsProducts ?? []).forEach(product => {
    map.set(product.id, product);
  });

  const ensureProduct = (id: string) => {
    if (!id || map.has(id) || !propsProducts) {
      return;
    }
    const product = propsProducts.find(item => item.id === id);
    if (product) {
      map.set(product.id, product);
    }
  };

  if (mode === 'single' && typeof value === 'string' && value) {
    ensureProduct(value);
  } else if (mode === 'multiple' && Array.isArray(value)) {
    value.forEach(ensureProduct);
  }

  return Array.from(map.values());
}

function deriveSelectedProduct(
  products: Product[],
  mode: ProductSelectorMode,
  value: string | string[]
): Product | null {
  if (mode !== 'single' || typeof value !== 'string' || !value) {
    return null;
  }
  return products.find(product => product.id === value) ?? null;
}

function deriveSelectedProducts(
  products: Product[],
  mode: ProductSelectorMode,
  value: string | string[]
): Product[] {
  if (mode !== 'multiple' || !Array.isArray(value) || value.length === 0) {
    return [];
  }

  const productMap = new Map(products.map(product => [product.id, product]));
  return value
    .map(productId => productMap.get(productId))
    .filter((product): product is Product => Boolean(product));
}

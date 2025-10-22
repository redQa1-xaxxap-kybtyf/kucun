'use client';

import React from 'react';
import type { Path, PathValue, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { useDebouncedCallback } from '@/hooks/use-debounced-search';
import { getProducts } from '@/lib/api/products';
import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import type { Product } from '@/lib/types/product';
import { ProductDataUtils } from '@/lib/utils/product-data';

import { SmartProductSearch } from './smart-product-search';

interface IntelligentProductInputProps<
  TFieldValues extends Record<string, unknown> = Record<string, unknown>,
> {
  form: UseFormReturn<TFieldValues>;
  index: number;
  products: Product[];
  onProductChange?: (product: Product | null) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
}

/**
 * 智能产品输入组件
 * 集成智能搜索和临时产品添加功能
 */
export function IntelligentProductInput<
  TFieldValues extends Record<string, unknown> = Record<string, unknown>,
>({
  form,
  index,
  products,
  onProductChange,
  onBatchSelect,
}: IntelligentProductInputProps<TFieldValues>) {
  const searchAbortControllerRef = React.useRef<AbortController | null>(null);
  const [extraProducts, setExtraProducts] = React.useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = React.useState(false);

  const allProducts = React.useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(product => {
      map.set(product.id, product);
    });
    extraProducts.forEach(product => {
      map.set(product.id, product);
    });
    return Array.from(map.values());
  }, [products, extraProducts]);

  // 使用防抖回调优化搜索性能
  const performSearch = React.useCallback(async (trimmed: string) => {
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    const controller = new AbortController();
    searchAbortControllerRef.current = controller;
    setIsSearchingProducts(true);

    try {
      const result = await getProducts({
        search: trimmed,
        limit: 50,
        includeInventory: true,
        includeStatistics: false,
        includeBatchSpecs: true,
      });

      if (!controller.signal.aborted) {
        setExtraProducts(prev => {
          const map = new Map<string, Product>();
          prev.forEach(product => map.set(product.id, product));
          result.data.forEach(product => map.set(product.id, product));
          return Array.from(map.values());
        });
      }
    } catch (error) {
      const name =
        (error as { name?: string } | undefined)?.name ??
        (error instanceof Error ? error.name : undefined);
      // 忽略 AbortError，这是正常的取消操作
      if (name === 'AbortError') {
        return;
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsSearchingProducts(false);
      }
      searchAbortControllerRef.current = null;
    }
  }, []);

  const handleProductSearch = useDebouncedCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setIsSearchingProducts(false);
      return;
    }
    performSearch(trimmed);
  }, 300);

  React.useEffect(
    () => () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
        searchAbortControllerRef.current = null;
      }
    },
    []
  );

  // 处理库存产品选择
  const handleProductSelect = (productId: string) => {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
      // 清空临时产品字段
      form.setValue(
        `items.${index}.isManualProduct` as unknown as Path<TFieldValues>,
        false as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(
        `items.${index}.manualProductName` as unknown as Path<TFieldValues>,
        '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(
        `items.${index}.manualSpecification` as unknown as Path<TFieldValues>,
        '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(
        `items.${index}.manualWeight` as unknown as Path<TFieldValues>,
        undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(
        `items.${index}.manualUnit` as unknown as Path<TFieldValues>,
        '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );

      form.setValue(
        `items.${index}.productCode` as unknown as Path<TFieldValues>,
        (product.code || '') as unknown as PathValue<
          TFieldValues,
          Path<TFieldValues>
        >
      );

      // 自动填充产品信息
      form.setValue(
        `items.${index}.specification` as unknown as Path<TFieldValues>,
        ProductDataUtils.formatter.formatSpecification(
          product.specification ?? ''
        ) as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );

      // 将英文单位转换为中文
      const unitLabel =
        product.unit && product.unit in PRODUCT_UNIT_LABELS
          ? PRODUCT_UNIT_LABELS[
              product.unit as keyof typeof PRODUCT_UNIT_LABELS
            ]
          : product.unit || '件';

      form.setValue(
        `items.${index}.unit` as unknown as Path<TFieldValues>,
        unitLabel as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      form.setValue(
        `items.${index}.piecesPerUnit` as unknown as Path<TFieldValues>,
        (product.piecesPerUnit || undefined) as unknown as PathValue<
          TFieldValues,
          Path<TFieldValues>
        >
      );
      form.setValue(
        `items.${index}.unitCost` as unknown as Path<TFieldValues>,
        undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>
      );
      const displayName = product.name?.trim() || product.code?.trim() || '';
      form.setValue(
        `items.${index}.displayName` as unknown as Path<TFieldValues>,
        displayName as unknown as PathValue<TFieldValues, Path<TFieldValues>>,
        { shouldDirty: true }
      );

      onProductChange?.(product);
    }
  };

  // 处理临时产品添加
  const handleTemporaryProductAdd = (productData: {
    name: string;
    specification?: string;
    weight?: number;
    unit?: string;
    piecesPerUnit?: number;
  }) => {
    // 清空库存产品选择
    form.setValue(
      `items.${index}.productId` as unknown as Path<TFieldValues>,
      undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );

    // 设置临时产品标识和信息
    form.setValue(
      `items.${index}.isManualProduct` as unknown as Path<TFieldValues>,
      true as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    const manualName = productData.name?.trim() ?? '';
    form.setValue(
      `items.${index}.manualProductName` as unknown as Path<TFieldValues>,
      manualName as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    form.setValue(
      `items.${index}.manualSpecification` as unknown as Path<TFieldValues>,
      (productData.specification || '') as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );
    form.setValue(
      `items.${index}.manualWeight` as unknown as Path<TFieldValues>,
      productData.weight as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );
    form.setValue(
      `items.${index}.manualUnit` as unknown as Path<TFieldValues>,
      (productData.unit || '') as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );
    form.setValue(
      `items.${index}.unitCost` as unknown as Path<TFieldValues>,
      undefined as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    form.setValue(
      `items.${index}.productCode` as unknown as Path<TFieldValues>,
      '' as unknown as PathValue<TFieldValues, Path<TFieldValues>>
    );
    form.setValue(
      `items.${index}.displayName` as unknown as Path<TFieldValues>,
      manualName as unknown as PathValue<TFieldValues, Path<TFieldValues>>,
      { shouldDirty: true }
    );

    // 自动填充到表单的通用字段（用于显示）
    form.setValue(
      `items.${index}.specification` as unknown as Path<TFieldValues>,
      (productData.specification || '') as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );
    form.setValue(
      `items.${index}.unit` as unknown as Path<TFieldValues>,
      (productData.unit || '') as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );
    form.setValue(
      `items.${index}.piecesPerUnit` as unknown as Path<TFieldValues>,
      (productData.piecesPerUnit ?? undefined) as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );

    const nextDisplayUnit =
      productData.unit === '件' &&
      productData.piecesPerUnit &&
      productData.piecesPerUnit > 0
        ? '件'
        : ((form.getValues(
            `items.${index}.displayUnit` as unknown as Path<TFieldValues>
          ) as unknown as '片' | '件' | undefined) ?? '片');
    form.setValue(
      `items.${index}.displayUnit` as unknown as Path<TFieldValues>,
      (nextDisplayUnit || '片') as unknown as PathValue<
        TFieldValues,
        Path<TFieldValues>
      >
    );

    onProductChange?.(null);
  };

  // 转换产品数据格式以匹配 SmartProductSearch 的类型要求
  const productsWithInventory = allProducts.map(p => {
    const batchSpecs = p.batchSpecs ?? [];
    const batchSpecMap = new Map(
      batchSpecs.map(spec => [spec.batchNumber, spec])
    );

    const inventoryBatches = p.inventory?.batches
      ? p.inventory.batches.map(b => {
          const spec = batchSpecMap.get(b.batchNumber);
          const normalizedPieces =
            typeof b.piecesPerUnit === 'number' && b.piecesPerUnit > 0
              ? b.piecesPerUnit
              : spec?.piecesPerUnit && spec.piecesPerUnit > 0
                ? spec.piecesPerUnit
                : undefined;
          const normalizedWeight =
            typeof (b as { weight?: number }).weight === 'number' &&
            (b as { weight?: number }).weight! > 0
              ? (b as { weight?: number }).weight
              : spec?.weight && spec.weight > 0
                ? spec.weight
                : undefined;

          return {
            batchNumber: b.batchNumber,
            quantity: b.quantity,
            piecesPerUnit: normalizedPieces,
            weight: normalizedWeight,
          };
        })
      : undefined;

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      specification: p.specification,
      unit: p.unit,
      piecesPerUnit: p.piecesPerUnit,
      weight: p.weight,
      status: p.status,
      batchSpecs: batchSpecs.length > 0 ? batchSpecs : undefined,
      inventory: p.inventory
        ? {
            totalInventory: p.inventory.totalQuantity || 0,
            availableInventory: p.inventory.availableQuantity || 0,
            reservedInventory: p.inventory.reservedQuantity || 0,
            batches: inventoryBatches,
          }
        : null,
    };
  });

  return (
    <FormField
      control={form.control}
      name={`items.${index}.productId` as unknown as Path<TFieldValues>}
      rules={{
        validate: (value: unknown) => {
          const isManualRaw = form.getValues(
            `items.${index}.isManualProduct` as unknown as Path<TFieldValues>
          );
          const isManual = Boolean(isManualRaw as unknown as boolean);
          const manualNameRaw = form.getValues(
            `items.${index}.manualProductName` as unknown as Path<TFieldValues>
          );
          const manualName =
            typeof manualNameRaw === 'string'
              ? manualNameRaw.trim()
              : manualNameRaw !== null && manualNameRaw !== undefined
                ? String(manualNameRaw).trim()
                : '';

          if (isManual) {
            return manualName.length > 0
              ? true
              : '手动输入商品必须填写商品名称';
          }

          const selected =
            typeof value === 'string'
              ? value.trim()
              : value !== null && value !== undefined
                ? String(value).trim()
                : '';

          return selected.length > 0 ? true : '请选择商品';
        },
      }}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <SmartProductSearch
              products={productsWithInventory}
              value={(field.value as string) || ''}
              onValueChange={value => {
                field.onChange(value);
                handleProductSelect(value);
              }}
              onBatchSelect={(productId, batchNumber) => {
                // 先设置产品ID
                field.onChange(productId);
                handleProductSelect(productId);

                // 使用 setTimeout 确保产品信息已更新后再设置批次号
                setTimeout(() => {
                  form.setValue(
                    `items.${index}.batchNumber` as unknown as Path<TFieldValues>,
                    batchNumber as unknown as PathValue<
                      TFieldValues,
                      Path<TFieldValues>
                    >
                  );
                  // 调用外部回调
                  onBatchSelect?.(productId, batchNumber);
                }, 0);
              }}
              onTemporaryProductAdd={handleTemporaryProductAdd}
              onSearchChange={handleProductSearch}
              isSearching={isSearchingProducts}
              placeholder="搜索商品或添加临时商品"
              className="h-8 text-xs"
              allowTemporaryProducts={true}
              simple={true}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

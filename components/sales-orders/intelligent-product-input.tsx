'use client';

import React from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { getProducts } from '@/lib/api/products';
import { PRODUCT_UNIT_LABELS } from '@/lib/config/product';
import type { Product } from '@/lib/types/product';
import { ProductDataUtils } from '@/lib/utils/product-data';

import { SmartProductSearch } from './smart-product-search';

interface IntelligentProductInputProps<T extends FieldValues = FieldValues> {
  form: UseFormReturn<T>;
  index: number;
  products: Product[];
  onProductChange?: (product: Product | null) => void;
  onBatchSelect?: (productId: string, batchNumber: string) => void;
  orderType?: 'NORMAL' | 'TRANSFER';
  placeholder?: string;
}

/**
 * 智能产品输入组件
 * 集成智能搜索和临时产品添加功能
 *
 * @template T - 表单数据类型，必须包含 items 数组字段
 *
 * 支持的表单类型：
 * - SalesOrderCreateFormData (销售订单)
 * - CreateFactoryShipmentOrderData (厂家发货订单)
 *
 * 要求表单的 items[index] 包含以下字段：
 * - productId, isManualProduct, manualProductName, manualSpecification,
 *   manualWeight, manualUnit, productCode, specification, unit,
 *   piecesPerUnit, displayUnit, batchNumber, unitCost
 */
export function IntelligentProductInput<T extends FieldValues = FieldValues>({
  form,
  index,
  products,
  onProductChange,
  onBatchSelect,
  orderType: _orderType,
  placeholder,
}: IntelligentProductInputProps<T>) {
  const searchAbortControllerRef = React.useRef<AbortController | null>(null);
  const [extraProducts, setExtraProducts] = React.useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = React.useState(false);

  const requireManualCode = true;
  const requireManualName = false;

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

  // 使用 useCallback 包裹搜索处理函数，避免每次渲染都创建新函数
  // 注意：SmartProductSearch 内部已经做了防抖（250ms），所以这里不需要再次防抖
  const handleProductSearch = React.useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        // 清空搜索时，重置搜索状态和额外产品
        setIsSearchingProducts(false);
        setExtraProducts([]);
        return;
      }
      // 只有当搜索词不为空时才执行搜索
      performSearch(trimmed);
    },
    [performSearch]
  );

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
  const handleProductSelect = React.useCallback(
    (productId: string) => {
      const product = allProducts.find(p => p.id === productId);
      if (product) {
        // 清空临时产品字段
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const setFormValue = form.setValue as any;
        setFormValue(`items.${index}.isManualProduct`, false);
        setFormValue(`items.${index}.manualProductName`, '');
        setFormValue(`items.${index}.manualSpecification`, '');
        setFormValue(`items.${index}.manualWeight`, undefined);
        setFormValue(`items.${index}.manualUnit`, '');

        setFormValue(`items.${index}.productCode`, product.code || '');

        // 自动填充产品信息
        setFormValue(
          `items.${index}.specification`,
          ProductDataUtils.formatter.formatSpecification(
            product.specification ?? ''
          )
        );

        // 将英文单位转换为中文
        const unitLabel =
          product.unit && product.unit in PRODUCT_UNIT_LABELS
            ? PRODUCT_UNIT_LABELS[
                product.unit as keyof typeof PRODUCT_UNIT_LABELS
              ]
            : product.unit || '件';

        setFormValue(`items.${index}.unit`, unitLabel);
        setFormValue(
          `items.${index}.piecesPerUnit`,
          product.piecesPerUnit || undefined
        );
        setFormValue(`items.${index}.unitCost`, undefined);

        onProductChange?.(product);
      }
    },
    [allProducts, form, index, onProductChange]
  );

  // 处理临时产品添加
  const handleTemporaryProductAdd = React.useCallback(
    (productData: {
      productCode?: string;
      name: string;
      specification?: string;
      weight?: number;
      unit?: string;
      piecesPerUnit?: number;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setFormValue = form.setValue as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getFormValues = form.getValues as any;

      // 清空库存产品选择
      setFormValue(`items.${index}.productId`, undefined);

      // 设置临时产品标识和信息
      setFormValue(`items.${index}.isManualProduct`, true);
      const manualName = productData.name?.trim() ?? '';
      const manualCode = productData.productCode?.trim() ?? '';
      setFormValue(
        `items.${index}.manualProductName`,
        manualName === '' ? undefined : manualName
      );
      setFormValue(
        `items.${index}.manualSpecification`,
        productData.specification || ''
      );
      setFormValue(`items.${index}.manualWeight`, productData.weight);
      setFormValue(`items.${index}.manualUnit`, productData.unit || '');
      setFormValue(`items.${index}.unitCost`, undefined);
      setFormValue(`items.${index}.productCode`, manualCode || undefined);

      // 自动填充到表单的通用字段（用于显示）
      setFormValue(
        `items.${index}.specification`,
        productData.specification || ''
      );
      setFormValue(`items.${index}.unit`, productData.unit || '');
      setFormValue(
        `items.${index}.piecesPerUnit`,
        productData.piecesPerUnit ?? undefined
      );

      const nextDisplayUnit =
        productData.unit === '件' &&
        productData.piecesPerUnit &&
        productData.piecesPerUnit > 0
          ? '件'
          : ((getFormValues(`items.${index}.displayUnit`) as
              | '片'
              | '件'
              | undefined) ?? '片');
      setFormValue(`items.${index}.displayUnit`, nextDisplayUnit || '片');

      onProductChange?.(null);
    },
    [form, index, onProductChange]
  );

  // 转换产品数据格式以匹配 SmartProductSearch 的类型要求
  // 使用 useMemo 避免每次渲染都创建新对象，防止列表抖动
  const productsWithInventory = React.useMemo(
    () =>
      allProducts.map(p => {
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
              const batchWeight = (b as { weight?: number }).weight;
              const normalizedWeight =
                typeof batchWeight === 'number' && batchWeight > 0
                  ? batchWeight
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
      }),
    [allProducts]
  );

  // 使用 useCallback 稳定回调函数引用，避免触发子组件不必要的重渲染
  const handleValueChange = React.useCallback(
    (value: string) => {
      handleProductSelect(value);
    },
    [handleProductSelect]
  );

  const handleBatchSelectCallback = React.useCallback(
    (productId: string, batchNumber: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const setFormValue = form.setValue as any;
      // 先设置产品ID
      handleProductSelect(productId);

      // 使用 setTimeout 确保产品信息已更新后再设置批次号
      setTimeout(() => {
        setFormValue(`items.${index}.batchNumber`, batchNumber);
        // 调用外部回调
        onBatchSelect?.(productId, batchNumber);
      }, 0);
    },
    [form, index, handleProductSelect, onBatchSelect]
  );

  return (
    <FormField
      control={form.control}
      name={`items.${index}.productId` as never}
      rules={{
        validate: (value: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const getFormValues = form.getValues as any;
          const isManualRaw = getFormValues(`items.${index}.isManualProduct`);
          const isManual = Boolean(isManualRaw);
          const manualCodeRaw = getFormValues(`items.${index}.productCode`);
          const manualCode =
            typeof manualCodeRaw === 'string'
              ? manualCodeRaw.trim()
              : manualCodeRaw !== null && manualCodeRaw !== undefined
                ? String(manualCodeRaw).trim()
                : '';

          if (isManual) {
            if (requireManualCode && manualCode.length === 0) {
              return '临时商品必须填写产品编码';
            }
            return true;
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
                handleValueChange(value);
              }}
              onBatchSelect={(productId, batchNumber) => {
                field.onChange(productId);
                handleBatchSelectCallback(productId, batchNumber);
              }}
              onTemporaryProductAdd={handleTemporaryProductAdd}
              onSearchChange={handleProductSearch}
              isSearching={isSearchingProducts}
              placeholder={placeholder ?? '搜索商品或添加临时商品'}
              className="h-8 text-xs"
              allowTemporaryProducts={true}
              temporaryProductRequirements={{
                requireCode: requireManualCode,
                requireName: requireManualName,
              }}
              simple={true}
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}

'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { SupplierSelector } from '@/components/sales-orders/supplier-selector';
import {
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/components/ui/use-toast';
import {
  getLatestSupplierPrice,
  useSupplierPriceHistory,
} from '@/hooks/use-price-history';
import { getSuppliers, supplierQueryKeys } from '@/lib/api/suppliers';
import type { Supplier } from '@/lib/types/supplier';

interface SupplierPriceSelectorProps {
  form: UseFormReturn<any, any, any>;
  index: number;
  value: string | undefined;
  onChange: (value: string) => void;
  showLabel?: boolean; // 是否显示标签（在表格中使用时设为 false）
  onBlur?: () => void;
}

/**
 * 供应商价格选择器组件
 *
 * 功能：
 * 1. 选择供应商
 * 2. 自动查询供应商的产品历史价格
 * 3. 自动填充价格到表单
 *
 * 使用 React.memo 优化性能
 */
const SupplierPriceSelectorComponent = React.memo<SupplierPriceSelectorProps>(
  ({ form, index, value, onChange, showLabel = true, onBlur }) => {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const supplierListParams = React.useMemo(
      () => ({
        page: 1,
        limit: 100,
        status: 'active' as const,
        sortBy: 'name' as const,
        sortOrder: 'asc' as const,
      }),
      []
    );

    const { data: supplierResult, isLoading: isLoadingSuppliers } = useQuery({
      queryKey: supplierQueryKeys.list(supplierListParams),
      queryFn: () => getSuppliers(supplierListParams),
      staleTime: 5 * 60 * 1000,
    });

    const suppliers = supplierResult?.data ?? [];

    // 获取当前行的产品ID
    const currentProductId = form.watch(`items.${index}.productId`);

    // 查询供应商价格历史
    const { data: supplierPriceHistoryData } = useSupplierPriceHistory({
      supplierId: value,
      productId: currentProductId,
    });

    // 当供应商或产品变化时，自动填充价格
    useEffect(() => {
      if (
        value &&
        currentProductId &&
        supplierPriceHistoryData?.data &&
        supplierPriceHistoryData.data.length > 0
      ) {
        const supplierPrice = getLatestSupplierPrice(
          supplierPriceHistoryData.data,
          currentProductId
        );

        if (supplierPrice !== undefined) {
          // 获取当前价格，避免重复填充
          const currentPrice = form.getValues(`items.${index}.unitPrice`);

          // 只在价格为0或未设置时自动填充
          if (!currentPrice || currentPrice === 0) {
            form.setValue(`items.${index}.unitPrice`, supplierPrice);
            toast({
              title: '已自动填充供应商历史价格',
              description: `供应商对该产品的上次报价：￥${supplierPrice}`,
              duration: 2000,
            });
          }
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, currentProductId, supplierPriceHistoryData]);

    return (
      <FormItem>
        {showLabel && (
          <FormLabel className="text-sm font-semibold text-[hsl(var(--color-text-primary))]">
            供应商 <span className="text-[hsl(var(--color-error))]">*</span>
          </FormLabel>
        )}
        <FormControl>
          <SupplierSelector
            suppliers={suppliers}
            value={value}
            onValueChange={onChange}
            placeholder="请选择供应商"
            isLoading={isLoadingSuppliers}
            className="transition-all duration-200 focus:ring-2 focus:ring-[hsl(var(--color-primary))]/20"
            onSupplierCreated={(supplier: Supplier) => {
              queryClient.invalidateQueries({
                queryKey: supplierQueryKeys.list(supplierListParams),
              });
              onChange(supplier.id);
            }}
            onRefreshSuppliers={() => {
              queryClient.invalidateQueries({
                queryKey: supplierQueryKeys.list(supplierListParams),
              });
            }}
            onBlur={onBlur}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    );
  }
);

SupplierPriceSelectorComponent.displayName = 'SupplierPriceSelector';

export const SupplierPriceSelector = SupplierPriceSelectorComponent;

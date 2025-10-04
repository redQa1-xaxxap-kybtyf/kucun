'use client';

import { useEffect } from 'react';
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
import type { CreateFactoryShipmentOrderData } from '@/lib/validations/factory-shipment';

interface SupplierPriceSelectorProps {
  form: UseFormReturn<CreateFactoryShipmentOrderData>;
  index: number;
  value: string;
  onChange: (value: string) => void;
}

/**
 * 供应商价格选择器组件
 *
 * 功能：
 * 1. 选择供应商
 * 2. 自动查询供应商的产品历史价格
 * 3. 自动填充价格到表单
 */
export function SupplierPriceSelector({
  form,
  index,
  value,
  onChange,
}: SupplierPriceSelectorProps) {
  const { toast } = useToast();

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
            description: `供应商对该产品的上次报价：¥${supplierPrice}`,
            duration: 2000,
          });
        }
      }
    }
  }, [value, currentProductId, supplierPriceHistoryData, form, index, toast]);

  return (
    <FormItem>
      <FormLabel className="text-xs font-medium">供应商 *</FormLabel>
      <FormControl>
        <SupplierSelector
          value={value}
          onValueChange={onChange}
          placeholder="选择供应商"
          className="h-8 text-xs"
        />
      </FormControl>
      <FormMessage className="text-xs" />
    </FormItem>
  );
}

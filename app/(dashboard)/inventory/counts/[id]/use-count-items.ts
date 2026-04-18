/**
 * 库存盘点明细管理的自定义 Hook
 */

import * as React from 'react';

import { useToast } from '@/components/ui/use-toast';
import type { InventoryCountDetail } from '@/lib/types/inventory-count';

import {
  addCountItems,
  buildAddProductParams,
  buildGenerateAllParams,
  fetchAllInventoryRecords,
  filterNewRecords,
  getExistingItemKeys,
  handleApiError,
  prepareItemsPayload,
} from './count-items-helpers';

interface UseCountItemsProps {
  count: InventoryCountDetail;
  countId: string;
  canEditItems: boolean;
  onItemsChanged: () => void;
}

export function useCountItems({
  count,
  countId,
  canEditItems,
  onItemsChanged,
}: UseCountItemsProps) {
  const { toast } = useToast();
  const [isGenerateAllLoading, setIsGenerateAllLoading] = React.useState(false);
  const [isAddingProduct, setIsAddingProduct] = React.useState(false);

  /**
   * 生成全部盘点明细
   */
  const handleGenerateAll = React.useCallback(async () => {
    if (!canEditItems) return;

    setIsGenerateAllLoading(true);
    try {
      const params = buildGenerateAllParams(count);
      const inventories = await fetchAllInventoryRecords(params);

      if (!inventories.length) {
        toast({
          title: '没有可用库存',
          description: '当前条件下没有可用于盘点的库存记录',
        });
        return;
      }

      const existingKeys = getExistingItemKeys(count);
      const newRecords = filterNewRecords(inventories, existingKeys);

      if (!newRecords.length) {
        toast({
          title: '没有新的盘点商品',
          description: '所有库存记录已经在当前盘点单中',
        });
        return;
      }

      const itemsPayload = prepareItemsPayload(newRecords);
      const response = await addCountItems(countId, itemsPayload);

      if (!response.ok) {
        await handleApiError(response, '生成盘点商品失败');
      }

      toast({
        title: '生成成功',
        description: `已新增 ${newRecords.length} 条盘点商品`,
      });
      onItemsChanged();
    } catch (error) {
      toast({
        title: '生成盘点商品失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    } finally {
      setIsGenerateAllLoading(false);
    }
  }, [canEditItems, count, countId, onItemsChanged, toast]);

  /**
   * 添加指定产品的盘点明细
   */
  const handleAddProductItems = React.useCallback(
    async (selectedProductId: string) => {
      if (!canEditItems) return;

      if (!selectedProductId) {
        toast({
          title: '请选择商品',
          description: '请选择要加入当前盘点单的商品',
          variant: 'destructive',
        });
        return;
      }

      setIsAddingProduct(true);
      try {
        const params = buildAddProductParams(count, selectedProductId);
        const inventories = await fetchAllInventoryRecords(params);

        if (!inventories.length) {
          toast({
            title: '没有可用库存',
            description: '该产品当前没有库存记录',
          });
          return;
        }

        const existingKeys = getExistingItemKeys(count);
        const newRecords = filterNewRecords(inventories, existingKeys);

        if (!newRecords.length) {
          toast({
            title: '没有新的盘点商品',
            description: '该商品相关库存记录已全部在当前盘点单中',
          });
          return;
        }

        const itemsPayload = prepareItemsPayload(newRecords);
        const response = await addCountItems(countId, itemsPayload);

        if (!response.ok) {
          await handleApiError(response, '添加盘点商品失败');
        }

        toast({
          title: '添加成功',
          description: `已为该商品新增 ${newRecords.length} 条盘点商品`,
        });
        onItemsChanged();
        return true; // 成功标志
      } catch (error) {
        toast({
          title: '添加盘点商品失败',
          description: error instanceof Error ? error.message : '未知错误',
          variant: 'destructive',
        });
        return false;
      } finally {
        setIsAddingProduct(false);
      }
    },
    [canEditItems, count, countId, onItemsChanged, toast]
  );

  return {
    isGenerateAllLoading,
    isAddingProduct,
    handleGenerateAll,
    handleAddProductItems,
  };
}

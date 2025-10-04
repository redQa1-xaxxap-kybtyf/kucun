/**
 * 库存操作表单的自定义Hook
 * 提取表单配置、验证和提交逻辑
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  adjustInventory,
  checkInventoryAvailability,
  createInbound,
  createOutbound,
} from '@/lib/api/inventory';
import { getProduct } from '@/lib/api/products';
import { queryKeys } from '@/lib/queryKeys';
import { type InboundFormData } from '@/lib/types/inbound';
import {
  type InboundRecord,
  type Inventory,
  type OutboundRecord,
} from '@/lib/types/inventory';
import { createInboundSchema } from '@/lib/validations/inbound';
import {
  inventoryAdjustDefaults,
  inventoryAdjustSchema,
  outboundCreateDefaults,
  outboundCreateSchema,
  type InventoryAdjustFormData,
  type OutboundCreateFormData,
} from '@/lib/validations/inventory-operations';

export type OperationMode = 'inbound' | 'outbound' | 'adjust';

export interface UseInventoryOperationFormProps {
  mode: OperationMode;
  onSuccess?: (result: InboundRecord | OutboundRecord | Inventory) => void;
}

export function useInventoryOperationForm({
  mode,
  onSuccess,
}: UseInventoryOperationFormProps) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const getFormConfig = () => {
    switch (mode) {
      case 'inbound':
        return {
          schema: createInboundSchema,
          defaultValues: {
            productId: '',
            inputQuantity: 1,
            inputUnit: 'pieces' as const,
            quantity: 1,
            reason: 'purchase' as const,
            remarks: '',
            batchNumber: '',
            piecesPerUnit: 1,
            weight: 0.01,
          },
          title: '库存入库',
          description: '添加新的库存记录',
        };
      case 'outbound':
        return {
          schema: outboundCreateSchema,
          defaultValues: outboundCreateDefaults,
          title: '库存出库',
          description: '减少库存数量',
        };
      case 'adjust':
        return {
          schema: inventoryAdjustSchema,
          defaultValues: inventoryAdjustDefaults,
          title: '库存调整',
          description: '调整库存数量',
        };
      default:
        throw new Error(`Unsupported mode: ${mode}`);
    }
  };

  const formConfig = getFormConfig();

  const form = useForm<
    InboundFormData | OutboundCreateFormData | InventoryAdjustFormData
  >({
    resolver: zodResolver(formConfig.schema),
    defaultValues: formConfig.defaultValues,
  });

  // 监听产品变化
  const watchedProductId = form.watch('productId');
  const watchedQuantity = form.watch('quantity' as keyof typeof form.getValues);

  // 获取产品信息
  const { data: productData } = useQuery({
    queryKey: queryKeys.products.detail(watchedProductId),
    queryFn: () => getProduct(watchedProductId),
    enabled: !!watchedProductId,
  });

  // 检查库存可用性（仅出库时）
  const { data: availabilityData } = useQuery({
    queryKey: queryKeys.inventory.availability(watchedProductId, undefined),
    queryFn: () =>
      checkInventoryAvailability(
        watchedProductId,
        Number(watchedQuantity) || 0
      ),
    enabled: mode === 'outbound' && !!watchedProductId && !!watchedQuantity,
    staleTime: 30000, // 30秒内不重新获取
  });

  // 入库 Mutation
  const inboundMutation = useMutation({
    mutationFn: createInbound,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      form.reset();
      setSubmitError('');
      onSuccess?.(response);
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '入库失败');
    },
  });

  // 出库 Mutation
  const outboundMutation = useMutation({
    mutationFn: createOutbound,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.inventory.all,
      });
      form.reset();
      setSubmitError('');
      onSuccess?.(response);
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '出库失败');
    },
  });

  // 调整 Mutation
  const adjustMutation = useMutation({
    mutationFn: adjustInventory,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lists() });
      form.reset();
      setSubmitError('');
      onSuccess?.(response);
    },
    onError: error => {
      setSubmitError(error instanceof Error ? error.message : '调整失败');
    },
  });

  const isLoading =
    inboundMutation.isPending ||
    outboundMutation.isPending ||
    adjustMutation.isPending;

  // 表单提交
  const onSubmit = async (
    data: InboundFormData | OutboundCreateFormData | InventoryAdjustFormData
  ) => {
    try {
      setSubmitError('');
      switch (mode) {
        case 'inbound':
          await inboundMutation.mutateAsync({
            ...(data as InboundFormData),
            type: 'normal_inbound' as const,
          });
          break;
        case 'outbound':
          await outboundMutation.mutateAsync(data as OutboundCreateFormData);
          break;
        case 'adjust':
          await adjustMutation.mutateAsync(data as InventoryAdjustFormData);
          break;
      }
    } catch (error) {
      // 错误已在mutation的onError中处理
    }
  };

  // 获取操作类型选项
  const getTypeOptions = () => {
    switch (mode) {
      case 'inbound':
        return [
          { value: 'purchase', label: '采购入库' },
          { value: 'return', label: '退货入库' },
          { value: 'transfer', label: '调拨入库' },
          { value: 'surplus', label: '盘盈入库' },
          { value: 'other', label: '其他入库' },
        ];
      case 'outbound':
        return [
          { value: 'normal_outbound', label: '正常出库' },
          { value: 'sales_outbound', label: '销售出库' },
          { value: 'adjust_outbound', label: '调整出库' },
        ];
      default:
        return [];
    }
  };

  return {
    form,
    formConfig,
    productData,
    availabilityData,
    submitError,
    isLoading,
    onSubmit,
    getTypeOptions,
  };
}

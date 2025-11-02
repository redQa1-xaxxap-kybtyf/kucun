'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { queryKeys } from '@/lib/queryKeys';
import type { SalesOrder } from '@/lib/types/sales-order';
import { transformFormDataToCreateInput } from '@/lib/utils/sales-order-transforms';
import { createOptimisticListMutation } from '@/lib/utils/optimistic-updates';
import type { SalesOrderCreateFormData as CreateSalesOrderData } from '@/lib/validations/sales-order';

export interface SalesOrderSubmissionResult {
  onSubmit: (data: CreateSalesOrderData) => void;
  handleSaveDraft: () => void;
  handleSubmitOrder: () => void;
  isSubmitting: boolean;
}

export function useSalesOrderSubmission(
  form: UseFormReturn<CreateSalesOrderData>,
  onSuccess: ((order: unknown) => void) | undefined,
  toast: (params: {
    title: string;
    description?: string;
    variant?: 'default' | 'destructive';
  }) => void
): SalesOrderSubmissionResult {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createSalesOrder,
    onSuccess: data => {
      toast({
        title: '创建成功',
        description: `销售订单 “${data.orderNumber}” 创建成功！`,
      });

      // ✅ 失效销售订单缓存
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

      // ✅ 关键修复：同时失效应收款缓存
      // 因为新订单会影响应收款列表数据
      queryClient.invalidateQueries({
        queryKey: queryKeys.finance.receivables(),
      });

      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push('/sales-orders');
      }
    },
    onError: error => {
      toast({
        title: '创建失败',
        description: error instanceof Error ? error.message : '创建失败',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = React.useCallback(
    (data: CreateSalesOrderData) => {
      const { orderNumber: _orderNumber, ...submitData } = data;
      const apiData = transformFormDataToCreateInput(submitData);
      createMutation.mutate(apiData);
    },
    [createMutation]
  );

  const submitWithStatus = React.useCallback(
    (nextStatus: CreateSalesOrderData['status']) => {
      form.setValue('status', nextStatus);
      form.handleSubmit(onSubmit)();
    },
    [form, onSubmit]
  );

  const handleSaveDraft = React.useCallback(() => {
    submitWithStatus('draft');
  }, [submitWithStatus]);

  const handleSubmitOrder = React.useCallback(() => {
    submitWithStatus('confirmed');
  }, [submitWithStatus]);

  return {
    onSubmit,
    handleSaveDraft,
    handleSubmitOrder,
    isSubmitting: createMutation.isPending,
  };
}

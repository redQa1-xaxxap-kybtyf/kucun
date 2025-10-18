'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { createSalesOrder, salesOrderQueryKeys } from '@/lib/api/sales-orders';
import { transformFormDataToCreateInput } from '@/lib/utils/sales-order-transforms';
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
      queryClient.invalidateQueries({ queryKey: salesOrderQueryKeys.lists() });

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

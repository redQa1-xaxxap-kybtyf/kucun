'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { payablesApi, payableQueryKeys } from '@/lib/api/payables';
import type {
  CreatePayableRecordData,
  PayableRecordDetail,
  UpdatePayableRecordData,
} from '@/lib/types/payable';
import { combineAsyncStates } from '@/lib/utils/async-state';
import { showError, showSuccess } from '@/lib/utils/toast-helper';
import {
  createPayableRecordSchema,
  updatePayableRecordSchema,
} from '@/lib/validations/payable';

interface UsePayableFormProps {
  mode: 'create' | 'edit';
  payableId?: string;
  initialData?: PayableRecordDetail;
  onSuccess?: (payable: PayableRecordDetail) => void;
  onCancel?: () => void;
}

type CreateFormData = z.infer<typeof createPayableRecordSchema>;
type UpdateFormData = z.infer<typeof updatePayableRecordSchema>;

function usePayableDetail(
  mode: UsePayableFormProps['mode'],
  payableId?: string,
  initialData?: PayableRecordDetail
) {
  const isEdit = mode === 'edit';

  const { data } = useQuery({
    queryKey: payableQueryKeys.detail(payableId || ''),
    queryFn: () => payablesApi.getPayableRecord(payableId || ''),
    enabled: isEdit && !!payableId && !initialData,
    staleTime: 5 * 60 * 1000,
  });

  return { isEdit, payableData: initialData || data };
}

function usePayableFormInstance(
  isEdit: boolean,
  payableData?: PayableRecordDetail
) {
  const defaultValues =
    isEdit && payableData
      ? {
          payableAmount: payableData.payableAmount,
          status: payableData.status,
          description: payableData.description || '',
          remarks: payableData.remarks || '',
        }
      : {
          supplierId: '',
          sourceType: 'other' as const,
          sourceId: undefined,
          sourceNumber: undefined,
          payableAmount: 0,
          description: '',
          remarks: '',
        };

  return useForm<CreateFormData | UpdateFormData>({
    resolver: zodResolver(
      isEdit ? updatePayableRecordSchema : createPayableRecordSchema
    ),
    defaultValues,
  });
}

interface UsePayableMutationsOptions {
  queryClient: ReturnType<typeof useQueryClient>;
  router: ReturnType<typeof useRouter>;
  setSubmitError: (error: string) => void;
  onSuccess?: (payable: PayableRecordDetail) => void;
}

function usePayableMutations({
  queryClient,
  router,
  setSubmitError,
  onSuccess,
}: UsePayableMutationsOptions) {
  const createMutation = useMutation({
    mutationFn: (data: CreatePayableRecordData) =>
      payablesApi.createPayableRecord(data),
    onSuccess: async data => {
      showSuccess('创建成功', {
        description: `应付款单号 "${data.payableNumber}" 创建成功！`,
      });

      await queryClient.invalidateQueries({
        queryKey: payableQueryKeys.lists(),
        refetchType: 'active',
      });

      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push('/finance/payables');
      }
    },
    onError: (error: Error) => {
      const errorMessage = error.message || '创建应付款失败';
      setSubmitError(errorMessage);
      showError('创建失败', { description: errorMessage });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableRecordData }) =>
      payablesApi.updatePayableRecord(id, data),
    onSuccess: async data => {
      showSuccess('更新成功', {
        description: `应付款单号 "${data.payableNumber}" 更新成功！`,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: payableQueryKeys.lists(),
          refetchType: 'active',
        }),
        queryClient.invalidateQueries({
          queryKey: payableQueryKeys.detail(data.id),
          refetchType: 'active',
        }),
      ]);

      if (onSuccess) {
        onSuccess(data);
      } else {
        router.push('/finance/payables');
      }
    },
    onError: (error: Error) => {
      const errorMessage = error.message || '更新应付款失败';
      setSubmitError(errorMessage);
      showError('更新失败', { description: errorMessage });
    },
  });

  return { createMutation, updateMutation };
}

/**
 * 应付款表单Hook
 * 处理应付款创建和编辑的表单逻辑
 */
export function usePayableForm({
  mode,
  payableId,
  initialData,
  onSuccess,
  onCancel,
}: UsePayableFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState('');

  const { isEdit, payableData } = usePayableDetail(
    mode,
    payableId,
    initialData
  );
  const form = usePayableFormInstance(isEdit, payableData);
  const { createMutation, updateMutation } = usePayableMutations({
    queryClient,
    router,
    setSubmitError,
    onSuccess,
  });

  const loadingState = combineAsyncStates([
    {
      isLoading: createMutation.isPending,
      isError: createMutation.isError,
      isSuccess: createMutation.isSuccess,
    },
    {
      isLoading: updateMutation.isPending,
      isError: updateMutation.isError,
      isSuccess: updateMutation.isSuccess,
    },
  ]);

  const isLoading = loadingState.isLoading;

  const onSubmit = async (data: CreateFormData | UpdateFormData) => {
    setSubmitError('');

    try {
      if (isEdit && (payableId || payableData?.id)) {
        await updateMutation.mutateAsync({
          id: payableId || payableData?.id || '',
          data: data as UpdatePayableRecordData,
        });
      } else {
        await createMutation.mutateAsync(data as CreatePayableRecordData);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '提交应付单失败，请稍后重试';
      setSubmitError(message);
      showError('提交失败', { description: message });
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return {
    form,
    isEdit,
    loadingState,
    isLoading,
    submitError,
    onSubmit,
    handleCancel,
    payableData,
  };
}

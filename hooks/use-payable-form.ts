'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { payablesApi, payableQueryKeys } from '@/lib/api/payables';
import type {
  CreatePayableRecordData,
  PayableRecordDetail,
  UpdatePayableRecordData,
} from '@/lib/types/payable';
import { showError, showSuccess } from '@/lib/utils/toast-helper';
import {
  createPayableRecordSchema,
  updatePayableRecordSchema,
} from '@/lib/validations/payable';
import type { z } from 'zod';

interface UsePayableFormProps {
  mode: 'create' | 'edit';
  payableId?: string;
  initialData?: PayableRecordDetail;
  onSuccess?: (payable: PayableRecordDetail) => void;
  onCancel?: () => void;
}

type CreateFormData = z.infer<typeof createPayableRecordSchema>;
type UpdateFormData = z.infer<typeof updatePayableRecordSchema>;

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

  const isEdit = mode === 'edit';

  // 获取应付款详情（编辑模式）
  const { data: payableData } = useQuery({
    queryKey: payableQueryKeys.detail(payableId || ''),
    queryFn: () => payablesApi.getPayableRecord(payableId || ''),
    enabled: isEdit && !!payableId && !initialData,
    staleTime: 5 * 60 * 1000,
  });

  const actualPayableData = initialData || payableData;

  // 初始化表单
  const form = useForm<CreateFormData | UpdateFormData>({
    resolver: zodResolver(
      isEdit ? updatePayableRecordSchema : createPayableRecordSchema
    ),
    defaultValues:
      isEdit && actualPayableData
        ? {
            payableAmount: actualPayableData.payableAmount,
            status: actualPayableData.status,
            description: actualPayableData.description || '',
            remarks: actualPayableData.remarks || '',
          }
        : {
            supplierId: '',
            sourceType: 'other' as const,
            sourceId: undefined,
            sourceNumber: undefined,
            payableAmount: 0,
            description: '',
            remarks: '',
          },
  });

  // 创建应付款
  const createMutation = useMutation({
    mutationFn: (data: CreatePayableRecordData) =>
      payablesApi.createPayableRecord(data),
    onSuccess: async data => {
      showSuccess('创建成功', `应付款单号 "${data.payableNumber}" 创建成功！`);

      // 失效应付款列表缓存
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
      showError('创建失败', errorMessage);
    },
  });

  // 更新应付款
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePayableRecordData }) =>
      payablesApi.updatePayableRecord(id, data),
    onSuccess: async data => {
      showSuccess('更新成功', `应付款单号 "${data.payableNumber}" 更新成功！`);

      // 失效相关缓存
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
      showError('更新失败', errorMessage);
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (data: CreateFormData | UpdateFormData) => {
    setSubmitError('');

    try {
      if (isEdit && (payableId || actualPayableData?.id)) {
        await updateMutation.mutateAsync({
          id: payableId || actualPayableData?.id || '',
          data: data as UpdatePayableRecordData,
        });
      } else {
        await createMutation.mutateAsync(data as CreatePayableRecordData);
      }
    } catch (error) {
      console.error('[usePayableForm] 提交应付单失败', error);
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
    isLoading,
    submitError,
    onSubmit,
    handleCancel,
    payableData: actualPayableData,
  };
}

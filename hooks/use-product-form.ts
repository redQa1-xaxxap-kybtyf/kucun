'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  createProduct,
  productQueryKeys,
  updateProduct,
} from '@/lib/api/products';
import { type Product } from '@/lib/types/product';
import { ProductDataUtils } from '@/lib/utils/product-data';
import {
  productCreateSchema,
  productUpdateSchema,
  type ProductCreateFormData,
  type ProductUpdateFormData,
} from '@/lib/validations/product';

interface UseProductFormProps {
  mode: 'create' | 'edit';
  initialData?: Product | undefined;
  onSuccess?: ((product: Product) => void) | undefined;
  onCancel?: (() => void) | undefined;
}

export function useProductForm({
  mode,
  initialData,
  onSuccess,
  onCancel,
}: UseProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string>('');

  // 表单配置
  const isEdit = mode === 'edit';
  const schema = isEdit ? productUpdateSchema : productCreateSchema;
  const defaultValues =
    isEdit && initialData
      ? ProductDataUtils.transformer.toFormData(initialData)
      : ProductDataUtils.transformer.getCreateDefaults();

  const form = useForm<ProductCreateFormData | ProductUpdateFormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  // 创建产品
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      onSuccess?.(response.data);
    },
    onError: (error: Error) => {
      setSubmitError(error.message || '创建产品失败');
    },
  });

  // 更新产品
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdateFormData }) =>
      updateProduct(id, data),
    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: productQueryKeys.all });
      onSuccess?.(response.data);
    },
    onError: (error: Error) => {
      setSubmitError(error.message || '更新产品失败');
    },
  });

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const onSubmit = async (
    data: ProductCreateFormData | ProductUpdateFormData
  ) => {
    setSubmitError('');

    try {
      if (isEdit && initialData) {
        const updateData = ProductDataUtils.transformer.toUpdateApiData(
          data as ProductUpdateFormData
        );
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: updateData,
        });
      } else {
        const createData = ProductDataUtils.transformer.toCreateApiData(
          data as ProductCreateFormData
        );
        await createMutation.mutateAsync(createData);
      }
    } catch (error) {
      // 错误已在mutation的onError中处理
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
  };
}

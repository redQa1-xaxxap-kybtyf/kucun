'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import {
  createProduct,
  getProduct,
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
  productId?: string | undefined;
  initialData?: Product | undefined;
  onSuccess?: ((product: Product) => void) | undefined;
  onCancel?: (() => void) | undefined;
}

export function useProductForm({
  mode,
  productId,
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

  // 如果是编辑模式且提供了productId但没有initialData，则预加载产品数据
  const { data: productData, isLoading: isLoadingProduct } = useQuery({
    queryKey: productQueryKeys.detail(productId!),
    queryFn: () => getProduct(productId!),
    enabled: isEdit && !!productId && !initialData,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });

  // 确定实际使用的产品数据
  const actualProductData = initialData || productData;

  const defaultValues =
    isEdit && actualProductData
      ? ProductDataUtils.transformer.toFormData(actualProductData)
      : ProductDataUtils.defaults.getCreateDefaults();

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

  const isLoading =
    createMutation.isPending || updateMutation.isPending || isLoadingProduct;

  const onSubmit = async (
    data: ProductCreateFormData | ProductUpdateFormData
  ) => {
    setSubmitError('');

    try {
      if (isEdit && (productId || actualProductData?.id)) {
        const updateData = ProductDataUtils.transformer.toUpdateApiData(
          data as ProductUpdateFormData
        );
        await updateMutation.mutateAsync({
          id: productId || (actualProductData?.id ?? ''),
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

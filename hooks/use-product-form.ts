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
import { showError, showSuccess } from '@/lib/utils/toast-helper';
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
    mode: 'onSubmit', // 只在提交时验证,不在onChange或onBlur时验证
    reValidateMode: 'onChange', // 提交后再次修改时实时验证
  });

  // 创建产品
  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: async product => {
      showSuccess('创建成功', {
        description: '产品已成功创建',
      });

      // 立即失效所有产品相关的查询缓存,确保数据最新
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all', // 强制重新获取所有相关查询,不仅仅是活跃的
      });

      // 强制刷新Router Cache,确保Server Component数据也更新
      router.refresh();

      onSuccess?.(product);
    },
    onError: (error: Error) => {
      const errorMessage = error.message || '创建产品失败';
      setSubmitError(errorMessage);
      showError('创建失败', {
        description: errorMessage,
      });
    },
  });

  // 更新产品
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdateFormData }) =>
      updateProduct(id, data),
    onSuccess: async product => {
      showSuccess('更新成功', {
        description: '产品已成功更新',
      });

      // 立即失效所有产品相关的查询缓存,确保数据最新
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all', // 强制重新获取所有相关查询,不仅仅是活跃的
      });

      // 强制刷新Router Cache,确保Server Component数据也更新
      router.refresh();

      onSuccess?.(product);
    },
    onError: (error: Error) => {
      const errorMessage = error.message || '更新产品失败';
      setSubmitError(errorMessage);
      showError('更新失败', {
        description: errorMessage,
      });
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

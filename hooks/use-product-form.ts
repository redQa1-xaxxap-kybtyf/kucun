'use client';

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

export type ProductFormSuccessHandler = (
  product: Product
) => void | boolean | Promise<void | boolean>;

interface UseProductFormProps {
  mode: 'create' | 'edit';
  productId?: string | undefined;
  initialData?: Product | undefined;
  onSuccess?: ProductFormSuccessHandler | undefined;
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
    defaultValues,
    mode: 'onSubmit', // 只在提交时验证,不在onChange或onBlur时验证
    reValidateMode: 'onChange', // 提交后再次修改时实时验证
  });
  const getFirstErrorMessage = (
    issues: readonly { message?: string }[]
  ): string | undefined => {
    for (const issue of issues) {
      if (issue?.message) {
        return issue.message;
      }
    }
    return undefined;
  };

  // 创建产品
  const navigateToList = () => {
    router.replace('/products');
  };

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

      let shouldNavigate = true;
      if (onSuccess) {
        try {
          const result = await Promise.resolve(onSuccess(product));
          if (result === false) {
            shouldNavigate = false;
          }
        } catch (error) {
          console.error('[useProductForm] onSuccess callback failed', error);
        }
      }

      if (shouldNavigate) {
        navigateToList();
      }
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

      let shouldNavigate = true;
      if (onSuccess) {
        try {
          const result = await Promise.resolve(onSuccess(product));
          if (result === false) {
            shouldNavigate = false;
          }
        } catch (error) {
          console.error('[useProductForm] onSuccess callback failed', error);
        }
      }

      if (shouldNavigate) {
        navigateToList();
      }
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
    form.clearErrors();

    if (process.env.NODE_ENV === 'development') {
      console.warn('[useProductForm] submit attempt', {
        mode,
        data,
      });
    }

    try {
      if (isEdit && (productId || actualProductData?.id)) {
        const updateInput: ProductUpdateFormData = {
          ...(data as ProductUpdateFormData),
        };

        if (typeof updateInput.code === 'string') {
          const trimmedCode = updateInput.code.trim();
          form.setValue('code', trimmedCode, {
            shouldDirty: true,
          });

          if (trimmedCode.length === 0) {
            form.setError('code', {
              type: 'manual',
              message: '产品编码不能为空',
            });
            return;
          }

          updateInput.code = trimmedCode;
        }

        if (typeof updateInput.name === 'string') {
          const trimmedName = updateInput.name.trim();
          form.setValue('name', trimmedName, {
            shouldValidate: false,
            shouldDirty: true,
          });
          updateInput.name = trimmedName;
        }

        if (typeof updateInput.specification === 'string') {
          const trimmedSpec = updateInput.specification.trim();
          form.setValue('specification', trimmedSpec, {
            shouldDirty: true,
          });

          if (trimmedSpec.length === 0) {
            form.setError('specification', {
              type: 'manual',
              message: '产品规格不能为空',
            });
            return;
          }

          updateInput.specification = trimmedSpec;
        }

        const parsed = productUpdateSchema.safeParse(updateInput);
        if (!parsed.success) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useProductForm] update validation failed', {
              issues: parsed.error.issues,
            });
          }
          parsed.error.issues.forEach(issue => {
            const field = issue.path[0];
            if (typeof field === 'string') {
              form.setError(field as keyof ProductUpdateFormData, {
                type: 'manual',
                message: issue.message,
              });
            }
          });
          const message = getFirstErrorMessage(parsed.error.issues);
          setSubmitError(message || '表单验证失败，请检查输入内容');
          return;
        }

        const normalizedUpdateData =
          ProductDataUtils.transformer.toUpdateApiData(parsed.data);
        await updateMutation.mutateAsync({
          id: productId || (actualProductData?.id ?? ''),
          data: normalizedUpdateData,
        });
      } else {
        const createInput: ProductCreateFormData = {
          ...(data as ProductCreateFormData),
        };

        const trimmedCode = createInput.code.trim();
        form.setValue('code', trimmedCode, {
          shouldDirty: true,
        });
        if (trimmedCode.length === 0) {
          form.setError('code', {
            type: 'manual',
            message: '产品编码不能为空',
          });
          return;
        }

        const trimmedSpec = createInput.specification.trim();
        form.setValue('specification', trimmedSpec, {
          shouldDirty: true,
        });
        if (trimmedSpec.length === 0) {
          form.setError('specification', {
            type: 'manual',
            message: '产品规格不能为空',
          });
          return;
        }

        createInput.code = trimmedCode;
        createInput.specification = trimmedSpec;

        if (typeof createInput.name === 'string') {
          const trimmedName = createInput.name.trim();
          form.setValue('name', trimmedName, {
            shouldValidate: false,
            shouldDirty: true,
          });
          createInput.name = trimmedName;
        }

        const parsed = productCreateSchema.safeParse(createInput);
        if (!parsed.success) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[useProductForm] create validation failed', {
              issues: parsed.error.issues,
            });
          }
          parsed.error.issues.forEach(issue => {
            const field = issue.path[0];
            if (typeof field === 'string') {
              form.setError(field as keyof ProductCreateFormData, {
                type: 'manual',
                message: issue.message,
              });
            }
          });
          const message = getFirstErrorMessage(parsed.error.issues);
          setSubmitError(message || '表单验证失败，请检查输入内容');
          return;
        }

        const createData = ProductDataUtils.transformer.toCreateApiData(
          parsed.data
        );
        await createMutation.mutateAsync(createData);
      }
    } catch {
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

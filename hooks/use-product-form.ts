'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import {
  createProduct,
  getProduct,
  productQueryKeys,
  updateProduct,
} from '@/lib/api/products';
import { type Product } from '@/lib/types/product';
import { combineAsyncStates } from '@/lib/utils/async-state';
import { logger } from '@/lib/utils/console-logger';
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

type CreateMutationResult = UseMutationResult<
  Product,
  Error,
  ProductCreateFormData
>;

type UpdateMutationResult = UseMutationResult<
  Product,
  Error,
  { id: string; data: ProductUpdateFormData }
>;

export type ProductFormValues = ProductCreateFormData &
  Partial<Omit<ProductUpdateFormData, keyof ProductCreateFormData>> & {
    id?: string;
  };

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

  const isEdit = mode === 'edit';
  const productQuery = useProductDetailData({ isEdit, productId, initialData });

  const actualProductData = initialData ?? productQuery.data ?? undefined;

  const defaultValues = useMemo(
    () => getProductFormDefaultValues(isEdit, actualProductData),
    [actualProductData, isEdit]
  );

  const form = useForm<ProductFormValues>({
    defaultValues,
    mode: 'onBlur', // ✅ 用户离开字段时验证
    reValidateMode: 'onChange', // ✅ 提交后实时验证
    criteriaMode: 'all', // ✅ 显示所有错误
    shouldFocusError: true,
  });

  const navigateToList = useCallback(() => {
    // ✅ Next.js 15 最佳实践：直接导航，服务端组件会自动获取最新数据
    // 因为 API 路由已经调用了 revalidatePath()，不需要额外的 refresh
    router.push('/products');
  }, [router]);

  const createMutation = useCreateProductMutation({
    queryClient,
    onSuccess,
    setSubmitError,
    navigateToList,
  });

  const updateMutation = useUpdateProductMutation({
    queryClient,
    onSuccess,
    setSubmitError,
    navigateToList,
  });

  const loadingState = getProductFormLoadingState({
    createMutation,
    updateMutation,
    productQuery,
    actualProductData,
  });

  const onSubmit = useCallback(
    async (values: ProductFormValues) => {
      setSubmitError('');
      form.clearErrors();
      await handleProductFormSubmit({
        values,
        isEdit,
        productId,
        actualProductData,
        form,
        setSubmitError,
        createMutation,
        updateMutation,
      });
    },
    [
      actualProductData,
      createMutation,
      form,
      isEdit,
      productId,
      setSubmitError,
      updateMutation,
    ]
  );

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.back();
  }, [onCancel, router]);

  return {
    form,
    isEdit,
    isLoading: loadingState.isLoading,
    loadingState,
    submitError,
    onSubmit,
    handleCancel,
  };
}

function useProductDetailData({
  isEdit,
  productId,
  initialData,
}: {
  isEdit: boolean;
  productId?: string;
  initialData?: Product;
}) {
  const shouldFetch = isEdit && Boolean(productId) && !initialData;
  const detailQueryKey = useMemo(
    () => productQueryKeys.detail(productId ?? '__placeholder__'),
    [productId]
  );

  return useQuery({
    queryKey: detailQueryKey,
    queryFn: async () => {
      if (!productId) {
        throw new Error('Missing productId');
      }
      return getProduct(productId);
    },
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000,
  });
}

function useCreateProductMutation({
  queryClient,
  onSuccess,
  setSubmitError,
  navigateToList,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onSuccess?: ProductFormSuccessHandler;
  setSubmitError: (message: string) => void;
  navigateToList: () => void;
}): CreateMutationResult {
  return useMutation({
    mutationFn: createProduct,
    onSuccess: async product => {
      showSuccess('创建成功', {
        description: '产品已成功创建',
      });

      // ✅ 使用 removeQueries 完全清除缓存，确保列表页必定重新获取数据
      await queryClient.removeQueries({
        queryKey: productQueryKeys.lists(),
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户创建产品后立即看到新记录
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.all,
        type: 'active',
      });

      const shouldNavigate = await handleSuccessCallback(onSuccess, product);
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
}

function useUpdateProductMutation({
  queryClient,
  onSuccess,
  setSubmitError,
  navigateToList,
}: {
  queryClient: ReturnType<typeof useQueryClient>;
  onSuccess?: ProductFormSuccessHandler;
  setSubmitError: (message: string) => void;
  navigateToList: () => void;
}): UpdateMutationResult {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdateFormData }) =>
      updateProduct(id, data),
    onSuccess: async product => {
      showSuccess('更新成功', {
        description: '产品已成功更新',
      });

      // ✅ 使用 removeQueries 完全清除缓存，确保列表页必定重新获取数据
      await queryClient.removeQueries({
        queryKey: productQueryKeys.lists(),
      });

      // ✅ 使用 refetchQueries 强制立即刷新，确保用户更新产品后立即看到变化
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.all,
        type: 'active',
      });

      const shouldNavigate = await handleSuccessCallback(onSuccess, product);
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
}

interface SubmitHandlerArgs {
  values: ProductFormValues;
  isEdit: boolean;
  productId?: string;
  actualProductData?: Product;
  form: UseFormReturn<ProductFormValues>;
  setSubmitError: (message: string) => void;
  createMutation: CreateMutationResult;
  updateMutation: UpdateMutationResult;
}

async function handleProductFormSubmit(args: SubmitHandlerArgs): Promise<void> {
  if (args.isEdit) {
    const targetId = args.productId ?? args.actualProductData?.id;
    if (!targetId) {
      args.setSubmitError('无法确定产品ID');
      return;
    }
    await handleUpdateSubmit({ ...args, targetId });
    return;
  }

  await handleCreateSubmit(args);
}

async function handleUpdateSubmit(
  args: SubmitHandlerArgs & { targetId: string }
): Promise<void> {
  const { values, form, setSubmitError, updateMutation, targetId } = args;

  const updateInput: ProductUpdateFormData = {
    code: values.code,
    name: values.name,
    specification: values.specification,
    description: values.description,
    piecesPerUnit: values.piecesPerUnit,
    weight: values.weight,
    thickness: values.thickness,
    status: values.status,
    categoryId: values.categoryId,
    thumbnailUrl: values.thumbnailUrl,
    images: values.images,
  };

  if (typeof updateInput.code === 'string') {
    const normalizedCode = normalizeRequiredTextField(
      form,
      setSubmitError,
      'code',
      updateInput.code,
      '产品编码不能为空'
    );
    if (normalizedCode === undefined) {
      return;
    }
    updateInput.code = normalizedCode;
  }

  if (typeof updateInput.name === 'string') {
    updateInput.name = normalizeOptionalTextField(
      form,
      'name',
      updateInput.name
    );
  }

  const normalizedSpec = normalizeRequiredTextField(
    form,
    setSubmitError,
    'specification',
    updateInput.specification,
    '产品规格不能为空'
  );
  if (normalizedSpec === undefined) {
    return;
  }
  updateInput.specification = normalizedSpec;

  const parsed = productUpdateSchema.safeParse(updateInput);
  if (!parsed.success) {
    handleValidationErrors(parsed.error.issues, form, setSubmitError);
    return;
  }

  const normalizedUpdateData = ProductDataUtils.transformer.toUpdateApiData(
    parsed.data
  );

  // ✅ 使用 try-catch 捕获错误，防止 Runtime Error overlay 显示
  // onError 会处理错误显示，这里只是防止错误冒泡
  try {
    await updateMutation.mutateAsync({
      id: targetId,
      data: normalizedUpdateData,
    });
  } catch (_error) {
    // 错误已由 onError 处理，这里只是防止冒泡
    // 不需要额外处理，因为 onError 已经设置了错误消息和显示了 Toast
  }
}

async function handleCreateSubmit(args: SubmitHandlerArgs): Promise<void> {
  const { values, form, setSubmitError, createMutation } = args;

  const code = normalizeRequiredTextField(
    form,
    setSubmitError,
    'code',
    values.code,
    '产品编码不能为空'
  );
  if (code === undefined) {
    return;
  }

  const specification = normalizeRequiredTextField(
    form,
    setSubmitError,
    'specification',
    values.specification,
    '产品规格不能为空'
  );
  if (specification === undefined) {
    return;
  }

  // 🎯 智能处理产品名称：如果为空则使用分类名称作为回退
  let productName = values.name;
  if (!productName || productName.trim() === '') {
    const categoryName = form.getValues('_categoryName' as any);
    if (categoryName && typeof categoryName === 'string') {
      productName = categoryName;
      // 更新表单显示，让用户看到最终使用的名称
      form.setValue('name', categoryName, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }

  const name = normalizeRequiredTextField(
    form,
    setSubmitError,
    'name',
    productName,
    '产品名称不能为空'
  );
  if (name === undefined) {
    return;
  }

  const createInput: ProductCreateFormData = {
    code,
    name,
    specification,
    description: values.description,
    thickness: values.thickness,
    status: values.status,
    categoryId: values.categoryId,
    thumbnailUrl: values.thumbnailUrl,
    images: values.images,
  };

  const parsed = productCreateSchema.safeParse(createInput);
  if (!parsed.success) {
    handleValidationErrors(parsed.error.issues, form, setSubmitError);
    return;
  }

  const createData = ProductDataUtils.transformer.toCreateApiData(parsed.data);

  // ✅ 使用 try-catch 捕获错误，防止 Runtime Error overlay 显示
  // onError 会处理错误显示，这里只是防止错误冒泡
  try {
    await createMutation.mutateAsync(createData);
  } catch (_error) {
    // 错误已由 onError 处理，这里只是防止冒泡
    // 不需要额外处理，因为 onError 已经设置了错误消息和显示了 Toast
  }
}

function getProductFormDefaultValues(
  isEdit: boolean,
  product?: Product
): Partial<ProductFormValues> {
  if (isEdit && product) {
    return ProductDataUtils.transformer.toFormData(
      product
    ) as Partial<ProductFormValues>;
  }
  return ProductDataUtils.defaults.getCreateDefaults();
}

function getProductFormLoadingState({
  createMutation,
  updateMutation,
  productQuery,
  actualProductData,
}: {
  createMutation: CreateMutationResult;
  updateMutation: UpdateMutationResult;
  productQuery: ReturnType<typeof useProductDetailData>;
  actualProductData?: Product;
}) {
  return combineAsyncStates([
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
    {
      isLoading: productQuery.isLoading,
      isError: productQuery.isError,
      isSuccess: !productQuery.isLoading && Boolean(actualProductData),
    },
  ]);
}

function normalizeRequiredTextField(
  form: UseFormReturn<ProductFormValues>,
  setSubmitError: (message: string) => void,
  field: 'code' | 'specification' | 'name', // ✅ 添加 'name' 支持
  value: unknown,
  message: string
): string | undefined {
  if (typeof value !== 'string') {
    form.setError(field, { type: 'manual', message });
    setSubmitError(message);
    return undefined;
  }

  const trimmed = value.trim();
  form.setValue(field, trimmed, {
    shouldDirty: true,
    shouldValidate: false,
  });

  if (trimmed.length === 0) {
    form.setError(field, { type: 'manual', message });
    setSubmitError(message);
    return undefined;
  }

  return trimmed;
}

function normalizeOptionalTextField(
  form: UseFormReturn<ProductFormValues>,
  field: keyof ProductFormValues,
  value: unknown
): string | undefined {
  if (typeof value !== 'string') {
    return value as string | undefined;
  }

  const trimmed = value.trim();
  form.setValue(field, trimmed, {
    shouldDirty: true,
    shouldValidate: false,
  });
  return trimmed;
}

function handleValidationErrors(
  issues: readonly { message?: string; path: PropertyKey[] }[],
  form: UseFormReturn<ProductFormValues>,
  setSubmitError: (message: string) => void
) {
  issues.forEach(issue => {
    const field = issue.path[0];
    if (typeof field === 'string') {
      form.setError(field as keyof ProductFormValues, {
        type: 'manual',
        message: issue.message,
      });
    }
  });

  const message =
    getFirstErrorMessage(issues) || '表单验证失败，请检查输入内容';
  setSubmitError(message);
}

function getFirstErrorMessage(
  issues: readonly { message?: string }[]
): string | undefined {
  for (const issue of issues) {
    if (issue?.message) {
      return issue.message;
    }
  }
  return undefined;
}

async function handleSuccessCallback(
  onSuccess: ProductFormSuccessHandler | undefined,
  product: Product
): Promise<boolean> {
  if (!onSuccess) {
    return true;
  }

  try {
    const result = await Promise.resolve(onSuccess(product));
    return result !== false;
  } catch (error) {
    logger.error('[useProductForm] onSuccess callback failed', { error });
    return true;
  }
}

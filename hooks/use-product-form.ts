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
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const navigateToList = useCallback(() => {
    router.replace('/products');
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

      // ✅ 修复: 先 invalidate 标记数据过时，再 refetch 主动刷新
      // 这样即使列表页设置了 refetchOnWindowFocus: false，也能看到最新数据
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });

      // 主动重新获取列表数据，确保导航回列表页时能看到新产品
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.lists(),
        type: 'active', // 只刷新当前活跃的列表查询
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

      // ✅ 修复: 先 invalidate 标记数据过时，再 refetch 主动刷新
      // 这样即使列表页设置了 refetchOnWindowFocus: false，也能看到最新数据
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });

      // 主动重新获取列表数据，确保导航回列表页时能看到更新后的产品
      await queryClient.refetchQueries({
        queryKey: productQueryKeys.lists(),
        type: 'active', // 只刷新当前活跃的列表查询
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
  await updateMutation.mutateAsync({
    id: targetId,
    data: normalizedUpdateData,
  });
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

  // 处理产品名称：如果为空且选择了分类，则使用分类名称
  let name =
    typeof values.name === 'string'
      ? normalizeOptionalTextField(form, 'name', values.name)
      : values.name;

  // 如果产品名称为空，尝试使用分类名称
  if (
    (!name || name.trim() === '') &&
    values.categoryId &&
    values.categoryId !== 'uncategorized'
  ) {
    const categoryName = form.getValues('_categoryName' as any);
    if (categoryName && typeof categoryName === 'string') {
      name = categoryName;
    }
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
  await createMutation.mutateAsync(createData);
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
  field: 'code' | 'specification',
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

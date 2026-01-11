'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { updateProductStatus as updateProductStatusAction } from '@/app/actions/products';
import { productQueryKeys } from '@/lib/api/products';
import { showError, showSuccess } from '@/lib/utils/toast-helper';

type ProductStatus = 'active' | 'inactive';

interface UseProductStatusUpdateOptions {
  onSuccess?: (data: { id: string; status: ProductStatus }) => void;
}

export function useProductStatusUpdate(
  options: UseProductStatusUpdateOptions = {}
) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation<
    { id: string; status: ProductStatus },
    Error,
    { id: string; status: ProductStatus }
  >({
    mutationFn: async (variables) => {
      const formData = new FormData();
      formData.set('productId', variables.id);
      formData.set('status', variables.status);

      const result = await updateProductStatusAction(formData);
      if (!result.success) {
        throw new Error(result.error || '更新产品状态失败');
      }

      return variables;
    },
    onSuccess: async data => {
      showSuccess(data.status === 'inactive' ? '已停用' : '已启用', {
        description:
          data.status === 'inactive'
            ? '产品已停用，后续在选择产品时将默认隐藏'
            : '产品已启用',
      });

      await queryClient.refetchQueries({
        queryKey: productQueryKeys.all,
        type: 'all',
      });

      router.refresh();
      options.onSuccess?.(data);
    },
    onError: (error: Error) => {
      showError('操作失败', {
        description: error.message || '更新产品状态失败',
      });
    },
  });

  return {
    statusMutation: mutation,
    isUpdatingStatus: mutation.isPending,
    updateStatus: (id: string, status: ProductStatus) =>
      mutation.mutate({ id, status }),
  };
}

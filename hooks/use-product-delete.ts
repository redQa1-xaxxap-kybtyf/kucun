'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { deleteProduct, productQueryKeys } from '@/lib/api/products';
import { showError, showSuccess } from '@/lib/utils/toast-helper';

interface UseProductDeleteProps {
  onDeleteSuccess?: () => void;
}

export function useProductDelete({
  onDeleteSuccess,
}: UseProductDeleteProps = {}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  // 单个删除mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      showSuccess('删除成功', {
        description: '产品已成功删除',
      });

      // 立即失效所有产品相关的查询缓存,确保数据最新
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all', // 强制重新获取所有相关查询,不仅仅是活跃的
      });

      // 强制刷新Router Cache,确保Server Component数据也更新
      router.refresh();

      onDeleteSuccess?.();
    },
    onError: (error: Error) => {
      showError('删除失败', {
        description: error.message || '删除产品时发生错误',
      });
    },
  });

  // 确认删除产品
  const confirmDeleteProduct = async (productId: string) => {
    if (!productId) {
      return;
    }
    deleteMutation.mutate(productId);
  };

  return {
    // Mutations
    deleteMutation,

    // 操作函数
    confirmDeleteProduct,

    // 状态
    isDeleting: deleteMutation.isPending,
  };
}

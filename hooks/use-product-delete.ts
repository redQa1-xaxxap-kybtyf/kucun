'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import {
  batchDeleteProducts,
  deleteProduct,
  productQueryKeys,
} from '@/lib/api/products';

import { showError, showSuccess } from '@/lib/utils/toast-helper';

interface UseProductDeleteProps {
  onDeleteSuccess?: () => void;
  onBatchDeleteSuccess?: () => void;
}

export function useProductDelete({
  onDeleteSuccess,
  onBatchDeleteSuccess,
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

  // 批量删除mutation
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteProducts,
    onSuccess: async result => {
      if (result.success) {
        showSuccess('批量删除完成', {
          description: result.message,
        });
      } else {
        showWarning('批量删除部分失败', {
          description: result.message,
        });
      }

      if (result.failedCount > 0 && result.failedProducts) {
        // 显示失败的产品详情
        const failedDetails = result.failedProducts
          .map(p => `${p.code}: ${p.reason}`)
          .join('\n');

        showError(`${result.failedCount} 个产品删除失败`, {
          description: failedDetails,
        });
      }

      // 立即失效所有产品相关的查询缓存,确保数据最新
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
        refetchType: 'all', // 强制重新获取所有相关查询,不仅仅是活跃的
      });

      // 强制刷新Router Cache,确保Server Component数据也更新
      router.refresh();

      onBatchDeleteSuccess?.();
    },
    onError: (error: Error) => {
      showError('批量删除失败', {
        description: error.message || '批量删除产品时发生错误',
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

  // 确认批量删除
  const confirmBatchDelete = (productIds: string[]) => {
    if (productIds.length === 0) {
      return;
    }
    batchDeleteMutation.mutate({ productIds });
  };

  return {
    // Mutations
    deleteMutation,
    batchDeleteMutation,

    // 操作函数
    confirmDeleteProduct,
    confirmBatchDelete,

    // 状态
    isDeleting: deleteMutation.isPending,
    isBatchDeleting: batchDeleteMutation.isPending,
  };
}

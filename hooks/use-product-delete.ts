'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/use-toast';
import {
  batchDeleteProducts,
  deleteProduct,
  productQueryKeys,
} from '@/lib/api/products';

interface UseProductDeleteProps {
  onDeleteSuccess?: () => void;
  onBatchDeleteSuccess?: () => void;
}

export function useProductDelete({
  onDeleteSuccess,
  onBatchDeleteSuccess,
}: UseProductDeleteProps = {}) {
  const queryClient = useQueryClient();

  // 单个删除mutation
  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: async () => {
      toast({
        title: '删除成功',
        description: '产品已成功删除',
        variant: 'success',
      });

      // 等待缓存失效完成，确保所有产品相关查询都会被重新获取
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });

      onDeleteSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message || '删除产品时发生错误',
        variant: 'destructive',
      });
    },
  });

  // 批量删除mutation
  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteProducts,
    onSuccess: async result => {
      if (result.success) {
        toast({
          title: '批量删除完成',
          description: result.message,
          variant: 'success',
        });
      } else {
        toast({
          title: '批量删除部分失败',
          description: result.message,
          variant: 'destructive',
        });
      }

      if (result.failedCount > 0 && result.failedProducts) {
        // 显示失败的产品详情
        const failedDetails = result.failedProducts
          .map(p => `${p.code}: ${p.reason}`)
          .join('\n');

        toast({
          title: `${result.failedCount} 个产品删除失败`,
          description: failedDetails,
          variant: 'destructive',
        });
      }

      // 等待缓存失效完成，确保所有产品相关查询都会被重新获取
      await queryClient.invalidateQueries({
        queryKey: productQueryKeys.all,
      });

      onBatchDeleteSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: '批量删除失败',
        description: error.message || '批量删除产品时发生错误',
        variant: 'destructive',
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

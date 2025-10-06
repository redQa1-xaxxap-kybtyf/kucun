/**
 * 退款管理客户端 API
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RefundRecordDetail } from '@/lib/types/refund';
import type { ProcessRefundInput } from '@/lib/validations/refund';

// Query Keys
export const refundQueryKeys = {
  all: ['refunds'] as const,
  details: () => [...refundQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...refundQueryKeys.details(), id] as const,
};

/**
 * 获取退款详情
 */
export async function getRefundDetail(id: string): Promise<RefundRecordDetail> {
  const response = await fetch(`/api/refunds/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '获取退款详情失败');
  }

  const data = await response.json();
  return data.data;
}

/**
 * 处理退款
 */
export async function processRefund(
  id: string,
  data: ProcessRefundInput
): Promise<RefundRecordDetail> {
  const response = await fetch(`/api/refunds/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '处理退款失败');
  }

  const result = await response.json();
  return result.data;
}

/**
 * 获取退款详情的 Hook
 */
export function useRefundDetail(id: string) {
  return useQuery({
    queryKey: refundQueryKeys.detail(id),
    queryFn: () => getRefundDetail(id),
    enabled: !!id,
  });
}

/**
 * 处理退款的 Hook
 */
export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessRefundInput }) =>
      processRefund(id, data),
    onSuccess: (_, { id }) => {
      // 刷新详情
      queryClient.invalidateQueries({
        queryKey: refundQueryKeys.detail(id),
      });
      // 刷新列表
      queryClient.invalidateQueries({
        queryKey: ['refunds', 'list'],
      });
    },
  });
}

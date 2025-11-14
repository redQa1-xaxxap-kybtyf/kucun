/**
 * 退款管理客户端 API
 */

import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import type { RefundRecordDetail } from '@/lib/types/refund';

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
 * 获取退款详情的 Hook
 */
export function useRefundDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.finance.refund(id),
    queryFn: () => getRefundDetail(id),
    enabled: !!id,
  });
}

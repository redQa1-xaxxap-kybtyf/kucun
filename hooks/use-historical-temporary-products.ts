import { useQuery } from '@tanstack/react-query';

import type {
  HistoricalTemporaryProductListResponse,
  HistoricalTemporaryProductQueryParams,
} from '@/lib/types/temporary-product';

/**
 * 查询外采产品列表
 */
export function useHistoricalTemporaryProducts(
  params: HistoricalTemporaryProductQueryParams
) {
  return useQuery<HistoricalTemporaryProductListResponse>({
    queryKey: ['temporary-products', 'history', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params.supplierId) {
        searchParams.set('supplierId', params.supplierId);
      }
      if (params.search) {
        searchParams.set('search', params.search);
      }
      if (params.page) {
        searchParams.set('page', params.page.toString());
      }
      if (params.limit) {
        searchParams.set('limit', params.limit.toString());
      }

      const response = await fetch(
        `/api/temporary-products/history?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error('查询外采产品失败');
      }

      return response.json();
    },
    enabled: !!params.supplierId, // 只有提供了 supplierId 才查询
  });
}

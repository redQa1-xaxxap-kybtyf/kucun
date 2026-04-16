import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

import {
  salesOrderQueryKeys,
  useUpdateSalesOrderStatus,
} from '@/lib/api/sales-orders';
import { queryKeys } from '@/lib/queryKeys';

describe('useUpdateSalesOrderStatus cache refresh', () => {
  const originalFetch = global.fetch;

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    };
  }

  beforeEach(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        async json() {
          return {
            success: true,
            data: {
              id: 'sales-order-1',
              status: 'shipped',
            },
          };
        },
      });
  });

  afterEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
  });

  afterAll(() => {
    (global as unknown as { fetch: typeof fetch }).fetch = originalFetch;
  });

  it('状态更新成功后会刷新列表缓存，并让跨模块数据失效', async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = jest.spyOn(queryClient, 'invalidateQueries');
    const refetchQueriesSpy = jest.spyOn(queryClient, 'refetchQueries');
    const wrapper = createWrapper(queryClient);

    const { result } = renderHook(() => useUpdateSalesOrderStatus(), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: 'sales-order-1',
        status: 'shipped',
        idempotencyKey: 'status-refresh-test',
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: salesOrderQueryKeys.all,
      })
    );
    expect(refetchQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: salesOrderQueryKeys.lists(),
        type: 'all',
      })
    );
    expect(refetchQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: salesOrderQueryKeys.statistics(),
        type: 'all',
      })
    );
    expect(invalidateQueriesSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: queryKeys.finance.all,
      })
    );
  });
});

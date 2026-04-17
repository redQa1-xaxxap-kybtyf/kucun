import { act, renderHook } from '@testing-library/react';

import { useUrlSearchParams } from '@/hooks/url-search-params';
import type { ParamConfig } from '@/hooks/url-search-params';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();
let mockPathname = '/inventory';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

interface InventoryLikeParams {
  search: string;
  categoryId?: string;
  page: number;
}

const inventoryLikeParamsConfig: Record<
  keyof InventoryLikeParams,
  ParamConfig
> = {
  search: { type: 'string', default: '' },
  categoryId: { type: 'string', default: undefined },
  page: { type: 'number', default: 1, min: 1 },
};

describe('useUrlSearchParams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockPathname = '/inventory';
    window.history.replaceState({}, '', '/inventory');
  });

  test('连续更新参数时，应基于最新本地参数合并，避免后一次操作冲掉前一次搜索条件', () => {
    const { result } = renderHook(() =>
      useUrlSearchParams<InventoryLikeParams>(inventoryLikeParamsConfig, {
        basePath: '/inventory',
        shallow: true,
      })
    );

    act(() => {
      result.current.updateParams({ search: '测试砖-A', page: 1 });
      result.current.updateParams({ categoryId: 'category-1', page: 1 });
    });

    expect(result.current.params.search).toBe('测试砖-A');
    expect(result.current.params.categoryId).toBe('category-1');

    const finalUrl = new URL(window.location.href);
    expect(finalUrl.pathname).toBe('/inventory');
    expect(finalUrl.searchParams.get('search')).toBe('测试砖-A');
    expect(finalUrl.searchParams.get('categoryId')).toBe('category-1');
    expect(finalUrl.searchParams.get('page')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

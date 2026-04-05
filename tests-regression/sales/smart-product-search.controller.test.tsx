import { act, renderHook } from '@testing-library/react';

import { useSmartProductSearchController } from '@/components/sales-orders/smart-product-search/hooks/useSmartProductSearchController';
import type { ProductWithInventory } from '@/components/sales-orders/smart-product-search/types';

jest.mock('@/lib/utils/pinyin-loader', () => ({
  isPinyinSearchQuery: () => false,
  loadPinyinUtils: jest.fn(),
}));

const BASE_PRODUCTS: ProductWithInventory[] = [
  {
    id: 'product-1',
    code: 'SALEINV-001',
    name: '销售回归砖',
    specification: '800x800mm',
    unit: 'sheet',
    piecesPerUnit: 1,
    status: 'active',
    inventory: {
      totalInventory: 30,
      availableInventory: 30,
      reservedInventory: 0,
    },
  },
];

describe('smart product search controller', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => setTimeout(() => callback(0), 0) as unknown as number);
    jest
      .spyOn(global, 'cancelAnimationFrame')
      .mockImplementation(handle => clearTimeout(handle as unknown as NodeJS.Timeout));
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('打开后输入完整编码，应触发去空格后的远程搜索词', () => {
    const onSearchChange = jest.fn();

    const { result } = renderHook(() =>
      useSmartProductSearchController({
        products: BASE_PRODUCTS,
        onSearchChange,
      })
    );

    act(() => {
      result.current.setOpen(true);
    });

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      result.current.handleSearchValueChange('  SALEINV-001  ');
    });

    act(() => {
      jest.advanceTimersByTime(249);
    });

    expect(onSearchChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenLastCalledWith('SALEINV-001');
  });

  test('选中产品后，应关闭搜索并回传清空查询，避免残留旧搜索态', () => {
    const onSearchChange = jest.fn();
    const onValueChange = jest.fn();

    const { result } = renderHook(() =>
      useSmartProductSearchController({
        products: BASE_PRODUCTS,
        onSearchChange,
        onValueChange,
      })
    );

    act(() => {
      result.current.setOpen(true);
      jest.advanceTimersByTime(0);
    });

    act(() => {
      result.current.handleSearchValueChange('SALEINV-001');
      jest.advanceTimersByTime(250);
    });

    onSearchChange.mockClear();

    act(() => {
      result.current.handleProductSelect('product-1');
    });

    expect(onValueChange).toHaveBeenCalledWith('product-1');
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenLastCalledWith('');
    expect(result.current.open).toBe(false);
    expect(result.current.searchValue).toBe('');
  });

  test('已有选中产品时再次打开，应预填编码，支持精确搜索继续检索', () => {
    const onSearchChange = jest.fn();

    const { result } = renderHook(() =>
      useSmartProductSearchController({
        products: BASE_PRODUCTS,
        value: 'product-1',
        onSearchChange,
      })
    );

    act(() => {
      result.current.setOpen(true);
    });

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current.searchValue).toBe('SALEINV-001');
    expect(onSearchChange).not.toHaveBeenCalled();
  });
});

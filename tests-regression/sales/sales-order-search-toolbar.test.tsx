/* eslint-disable max-lines-per-function */

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';

import { SalesOrderSearchToolbar } from '@/components/sales-orders/sales-order-search-toolbar';
import type { SalesOrderQueryParams } from '@/lib/types/sales-order';

jest.mock('@/components/common/search-filter-card', () => ({
  SearchFilterCard: ({
    searchValue,
    searchPlaceholder,
    onSearchChange,
    onFilterChange,
    dateRangeFilter,
    customFilters,
    toggleButtons = [],
    onClearFilters,
  }: {
    searchValue?: string;
    searchPlaceholder?: string;
    onSearchChange: (value: string) => void;
    onFilterChange?: (key: string, value: string | undefined) => void;
    dateRangeFilter?: {
      onChange: (value: { startDate?: string; endDate?: string }) => void;
    };
    customFilters?: ReactNode;
    toggleButtons?: Array<{ key: string; label: string; onClick: () => void }>;
    onClearFilters?: () => void;
  }) => (
    <div data-testid="mobile-search-filter-card">
      <span>{searchPlaceholder}</span>
      <span>{searchValue}</span>
      <button
        type="button"
        onClick={() => {
          onSearchChange('SO-1001');
          onFilterChange?.('status', 'confirmed');
          onFilterChange?.('sortBy', 'createdAt');
          dateRangeFilter?.onChange({
            startDate: '2026-04-01',
            endDate: '2026-04-10',
          });
        }}
      >
        应用移动筛选
      </button>
      <div>{customFilters}</div>
      {toggleButtons.map(toggle => (
        <button key={toggle.key} type="button" onClick={toggle.onClick}>
          {toggle.label}
        </button>
      ))}
      {onClearFilters ? (
        <button type="button" onClick={onClearFilters}>
          清空全部
        </button>
      ) : null}
    </div>
  ),
}));

jest.mock('@/components/ui/date-range-picker', () => ({
  DateRangePicker: ({
    onChange,
    placeholder,
  }: {
    onChange: (value: { startDate?: string; endDate?: string }) => void;
    placeholder?: string;
  }) => (
    <button
      type="button"
      data-testid="sales-order-desktop-date-range"
      onClick={() =>
        onChange({
          startDate: '2026-04-01',
          endDate: '2026-04-10',
        })
      }
    >
      {placeholder || '选择订单日期范围'}
    </button>
  ),
}));

jest.mock('@/components/sales-orders/customer-selector', () => ({
  CustomerSelector: ({
    value,
    onValueChange,
    placeholder,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
  }) => (
    <button
      type="button"
      onClick={() => onValueChange?.(value ? '' : 'customer-1')}
    >
      {value || placeholder || '选择客户'}
    </button>
  ),
}));

describe('SalesOrderSearchToolbar', () => {
  const baseQueryParams: SalesOrderQueryParams = {
    page: 1,
    limit: 20,
    search: '',
    sortBy: 'orderDate',
    sortOrder: 'desc',
  };

  const baseProps = {
    queryParams: baseQueryParams,
    searchValue: '',
    onSearch: jest.fn(),
    onFilter: jest.fn(),
    onClearFilters: jest.fn(),
    isSearching: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应同时渲染移动端和桌面端工具栏容器', () => {
    render(<SalesOrderSearchToolbar {...baseProps} />);

    expect(
      screen.getByTestId('sales-order-mobile-search-toolbar')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-search-toolbar')
    ).toBeInTheDocument();
    expect(screen.getByTestId('mobile-search-filter-card')).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-search-input')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-status-filter')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-sort-filter')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-date-range')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('sales-order-desktop-customer-filter')
    ).toBeInTheDocument();
  });

  it('移动端筛选和快捷切换应映射为销售订单查询参数', () => {
    render(<SalesOrderSearchToolbar {...baseProps} />);

    const mobileToolbar = screen.getByTestId('sales-order-mobile-search-toolbar');

    fireEvent.click(
      within(mobileToolbar).getByRole('button', { name: '应用移动筛选' })
    );
    fireEvent.click(
      within(mobileToolbar).getByRole('button', { name: '选择客户筛选订单' })
    );
    fireEvent.click(
      within(mobileToolbar).getByRole('button', { name: '历史销售记录' })
    );
    fireEvent.click(
      within(mobileToolbar).getByRole('button', { name: '清空全部' })
    );

    expect(baseProps.onSearch).toHaveBeenCalledWith('SO-1001');
    expect(baseProps.onFilter).toHaveBeenCalledWith('status', 'confirmed');
    expect(baseProps.onFilter).toHaveBeenCalledWith('sortBy', 'createdAt');
    expect(baseProps.onFilter).toHaveBeenCalledWith(
      'dateRange',
      JSON.stringify({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
      })
    );
    expect(baseProps.onFilter).toHaveBeenCalledWith('customerId', 'customer-1');
    expect(baseProps.onFilter).toHaveBeenCalledWith('recordScope', 'history');
    expect(baseProps.onClearFilters).toHaveBeenCalled();
  });

  it('桌面端搜索和筛选变更应映射为销售订单查询参数', () => {
    render(<SalesOrderSearchToolbar {...baseProps} />);

    fireEvent.change(screen.getByTestId('sales-order-desktop-search-input'), {
      target: { value: 'SO-2026' },
    });
    fireEvent.change(screen.getByTestId('sales-order-desktop-status-filter'), {
      target: { value: 'shipped' },
    });
    fireEvent.change(screen.getByTestId('sales-order-desktop-sort-filter'), {
      target: { value: 'totalAmount' },
    });
    fireEvent.click(screen.getByTestId('sales-order-desktop-date-range'));
    fireEvent.click(
      within(screen.getByTestId('sales-order-desktop-customer-filter')).getByRole(
        'button',
        { name: '选择客户筛选订单' }
      )
    );

    expect(baseProps.onSearch).toHaveBeenCalledWith('SO-2026');
    expect(baseProps.onFilter).toHaveBeenCalledWith('status', 'shipped');
    expect(baseProps.onFilter).toHaveBeenCalledWith('sortBy', 'totalAmount');
    expect(baseProps.onFilter).toHaveBeenCalledWith(
      'dateRange',
      JSON.stringify({
        startDate: '2026-04-01',
        endDate: '2026-04-10',
      })
    );
    expect(baseProps.onFilter).toHaveBeenCalledWith('customerId', 'customer-1');
  });

  it('桌面端应支持清空客户和清空条件', () => {
    render(
      <SalesOrderSearchToolbar
        {...baseProps}
        queryParams={{
          ...baseQueryParams,
          customerId: 'customer-1',
          hasReturns: true,
        }}
      />
    );

    const desktopToolbar = screen.getByTestId('sales-order-desktop-search-toolbar');

    fireEvent.click(screen.getByTestId('sales-order-desktop-clear-customer'));
    fireEvent.click(
      within(desktopToolbar).getByRole('button', { name: '有退货' })
    );
    fireEvent.click(
      within(desktopToolbar).getByRole('button', { name: '清空条件' })
    );

    expect(baseProps.onFilter).toHaveBeenCalledWith('customerId', undefined);
    expect(baseProps.onFilter).toHaveBeenCalledWith('hasReturns', undefined);
    expect(baseProps.onClearFilters).toHaveBeenCalled();
  });
});

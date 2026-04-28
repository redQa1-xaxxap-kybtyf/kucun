import { fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent, ReactElement, ReactNode } from 'react';

import { BatchSelector } from '@/components/sales-orders/batch-selector';
import { useSmartProductSearchController } from '@/components/sales-orders/smart-product-search/hooks/useSmartProductSearchController';
import { SmartProductSearch } from '@/components/sales-orders/smart-product-search/SmartProductSearch';
import { useIsMobile } from '@/hooks/use-media-query';

jest.mock('next/dynamic', () => () => function DynamicComponent() { return null; });

jest.mock('@/components/ui/sheet', () => {
  const React = require('react') as typeof import('react');
  type MockSheetContextValue = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };
  const SheetContext = React.createContext<MockSheetContextValue>({
    open: false,
    onOpenChange: () => undefined,
  });

  const Sheet = ({
    open = false,
    onOpenChange,
    children,
  }: {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: ReactNode;
  }) => (
    <SheetContext.Provider
      value={{
        open,
        onOpenChange: onOpenChange ?? (() => undefined),
      }}
    >
      {children}
    </SheetContext.Provider>
  );

  const SheetTrigger = ({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children: ReactElement;
  }) => {
    const { open, onOpenChange } = React.useContext(SheetContext);

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children, {
        onClick: (event: MouseEvent) => {
          children.props.onClick?.(event);
          onOpenChange(!open);
        },
      });
    }

    return (
      <button type="button" onClick={() => onOpenChange(!open)}>
        {children}
      </button>
    );
  };

  const SheetContent = ({
    children,
  }: {
    children: ReactNode;
  }) => {
    const { open } = React.useContext(SheetContext);
    return open ? <div data-testid="mock-sheet-content">{children}</div> : null;
  };

  return {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    SheetDescription: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

jest.mock('@/hooks/use-media-query', () => ({
  useIsMobile: jest.fn(),
}));

jest.mock(
  '@/components/sales-orders/smart-product-search/hooks/useSmartProductSearchController',
  () => ({
    useSmartProductSearchController: jest.fn(),
  })
);

jest.mock(
  '@/components/sales-orders/smart-product-search/components/ProductSearchEmptyState',
  () => ({
    ProductSearchEmptyState: ({
      searchValue,
    }: {
      searchValue: string;
    }) => <div>空结果：{searchValue || '未输入'}</div>,
  })
);

jest.mock(
  '@/components/sales-orders/smart-product-search/components/ProductSearchLoadingIndicator',
  () => ({
    ProductSearchLoadingIndicator: () => <div>搜索中</div>,
  })
);

jest.mock(
  '@/components/sales-orders/smart-product-search/components/ProductSearchResults',
  () => ({
    ProductSearchResults: () => <div>结果列表</div>,
  })
);

const mockUseIsMobile = jest.mocked(useIsMobile);
const mockUseSmartProductSearchController = jest.mocked(
  useSmartProductSearchController
);

describe('sales order mobile pickers', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: ResizeObserverMock,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('移动端产品搜索应使用底部抽屉，方便手机开单', () => {
    mockUseIsMobile.mockReturnValue(true);
    mockUseSmartProductSearchController.mockReturnValue({
      open: true,
      setOpen: jest.fn(),
      searchValue: 'DWB-01',
      handleSearchValueChange: jest.fn(),
      showAddDialog: false,
      setShowAddDialog: jest.fn(),
      filteredProducts: [],
      isSearchPending: false,
      selectedProduct: null,
      selectedSpecification: '',
      handleProductSelect: jest.fn(),
      handleBatchSelect: jest.fn(),
      handleAddTemporaryProduct: jest.fn(),
      handleTemporaryProductAdded: jest.fn(),
    });

    render(
      <SmartProductSearch
        products={[]}
        value={undefined}
        placeholder="搜索产品"
      />
    );

    expect(screen.getByText('选择产品')).toBeInTheDocument();
    expect(
      screen.getByText('支持按编码、名称、规格搜索，也可以直接补录临时产品。')
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('输入产品名称、编码或规格搜索...')
    ).toBeInTheDocument();
  });

  test('移动端批次选择应改为抽屉，并支持搜索后直接选择', () => {
    mockUseIsMobile.mockReturnValue(true);
    const onValueChange = jest.fn();

    render(
      <BatchSelector
        batches={[
          { batchNumber: 'BATCH-001', quantity: 120, piecesPerUnit: 4 },
          { batchNumber: 'BATCH-002', quantity: 80, piecesPerUnit: 2 },
        ]}
        onValueChange={onValueChange}
      />
    );

    fireEvent.click(screen.getByRole('combobox'));

    const sheetContent = screen.getByTestId('mock-sheet-content');

    expect(sheetContent).toHaveTextContent('选择批次');
    expect(sheetContent).toHaveTextContent('共 2 个可用批次');
    expect(screen.getByPlaceholderText('搜索批次号...')).toBeInTheDocument();

    fireEvent.click(screen.getByText('BATCH-002'));

    expect(onValueChange).toHaveBeenCalledWith('BATCH-002');
  });
});

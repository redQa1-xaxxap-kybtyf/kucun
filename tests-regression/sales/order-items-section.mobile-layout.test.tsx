import { render, screen } from '@testing-library/react';
import { FormProvider, useForm, type FieldArrayWithId } from 'react-hook-form';

import { OrderItemsSection } from '@/components/sales-orders/erp-sales-order-form/OrderItemsSection';
import { useIsMobile } from '@/hooks/use-media-query';
import type { SalesOrderCreateFormData } from '@/lib/validations/sales-order';

jest.mock('next/dynamic', () => () => function DynamicComponent() { return null; });

jest.mock('@/hooks/use-media-query', () => ({
  useIsMobile: jest.fn(),
}));

const mockUseIsMobile = jest.mocked(useIsMobile);

function renderOrderItemsSection(isMobile: boolean) {
  mockUseIsMobile.mockReturnValue(isMobile);

  function TestComponent() {
    const form = useForm<SalesOrderCreateFormData>({
      defaultValues: {
        items: [{} as SalesOrderCreateFormData['items'][number]],
      } as SalesOrderCreateFormData,
    });

    return (
      <FormProvider {...form}>
        <OrderItemsSection
          fields={[{ id: 'item-1' } as FieldArrayWithId<
            SalesOrderCreateFormData,
            'items',
            'id'
          >]}
          remove={jest.fn()}
          onAddItem={jest.fn()}
          isSubmitting={false}
          products={[]}
          orderType="NORMAL"
          unitMapping={{}}
          form={form}
          priceType="SALES"
          toast={jest.fn()}
        />
      </FormProvider>
    );
  }

  return render(<TestComponent />);
}

describe('OrderItemsSection mobile layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('移动端应渲染明细卡片列表，不再显示横向表头', () => {
    renderOrderItemsSection(true);

    expect(screen.getByTestId('sales-order-mobile-item-list')).toBeInTheDocument();
    expect(screen.queryByText('产品编码')).not.toBeInTheDocument();
  });

  test('桌面端应继续渲染表格表头', () => {
    renderOrderItemsSection(false);

    expect(
      screen.queryByTestId('sales-order-mobile-item-list')
    ).not.toBeInTheDocument();
    expect(screen.getByText('产品编码')).toBeInTheDocument();
    expect(screen.getByText('销售单价')).toBeInTheDocument();
  });
});

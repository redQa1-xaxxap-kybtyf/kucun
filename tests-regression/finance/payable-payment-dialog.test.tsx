import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { PayablePaymentDialog } from '@/components/finance/payables-client/PayablePaymentDialog';
import { payablesApi } from '@/lib/api/payables';

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('PayablePaymentDialog', () => {
  test('页脚保存按钮应通过原生表单提交触发付款登记', async () => {
    const createPaymentOutRecordSpy = jest
      .spyOn(payablesApi, 'createPaymentOutRecord')
      .mockResolvedValue({ id: 'payment-out-1' } as any);
    const onOpenChange = jest.fn();

    render(
      <PayablePaymentDialog
        open
        onOpenChange={onOpenChange}
        payableInfo={
          {
            id: 'payable-1',
            payableNumber: 'YFD-20260416-001',
            supplier: {
              id: 'supplier-1',
              name: '测试供应商',
            },
            payableAmount: 88,
            paidAmount: 0,
            remainingAmount: 88,
            dueDate: null,
          } as any
        }
      />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getAllByDisplayValue('88')).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('button', { name: /确认付款/ }));

    await waitFor(() => {
      expect(createPaymentOutRecordSpy).toHaveBeenCalledTimes(1);
    });

    expect(createPaymentOutRecordSpy.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        payableRecordId: 'payable-1',
        supplierId: 'supplier-1',
        paymentAmount: 88,
        actualPaymentAmount: 88,
        roundingAmount: 0,
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

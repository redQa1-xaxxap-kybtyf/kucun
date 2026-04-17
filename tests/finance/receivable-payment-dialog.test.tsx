import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import {
  ReceivablePaymentDialog,
  type ReceivablePaymentTarget,
} from '@/components/finance/receivable-payment-dialog';

const mockCreatePaymentRecord = jest.fn();
const mockConfirmPayment = jest.fn();
const mockToast = jest.fn();
const mockInvalidateFinanceCaches = jest.fn();

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

jest.mock('@/hooks/use-unsaved-changes-guard', () => ({
  useUnsavedChangesGuard: () => ({
    confirmLeavePage: () => true,
  }),
}));

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: (...args: unknown[]) => mockToast(...args),
  }),
}));

jest.mock('@/lib/cache/invalidation-helpers', () => ({
  invalidateFinanceCaches: (...args: unknown[]) =>
    mockInvalidateFinanceCaches(...args),
}));

jest.mock('@/lib/api/payments', () => ({
  useCreatePaymentRecord: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => mockCreatePaymentRecord(...args),
  }),
  useConfirmPayment: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => mockConfirmPayment(...args),
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

function createReceivable(): ReceivablePaymentTarget {
  return {
    id: 'sales-order-1',
    orderNumber: 'SO202604170001',
    customerId: 'customer-1',
    customerName: '测试客户',
    totalAmount: 1280,
    paidAmount: 0,
    remainingAmount: 1280,
    lastPaymentDate: undefined,
  };
}

describe('ReceivablePaymentDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreatePaymentRecord.mockResolvedValue({ id: 'payment-1' });
    mockConfirmPayment.mockResolvedValue({ id: 'payment-1', status: 'confirmed' });
  });

  test('可以只登记待确认收款，不会直接确认到账', async () => {
    const user = userEvent.setup();

    render(
      <ReceivablePaymentDialog
        open
        onOpenChange={jest.fn()}
        receivable={createReceivable()}
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: '登记待确认收款' }));

    await waitFor(() => {
      expect(mockCreatePaymentRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentType: 'order_payment',
          salesOrderId: 'sales-order-1',
          customerId: 'customer-1',
          paymentAmount: 1280,
          actualPaymentAmount: 1280,
          roundingAmount: 0,
        })
      );
    });

    expect(mockConfirmPayment).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '已登记待确认收款',
        variant: 'success',
      })
    );
  });

  test('可以登记后立即确认到账', async () => {
    const user = userEvent.setup();

    render(
      <ReceivablePaymentDialog
        open
        onOpenChange={jest.fn()}
        receivable={createReceivable()}
      />,
      { wrapper: createWrapper() }
    );

    await user.click(screen.getByRole('button', { name: '登记并确认到账' }));

    await waitFor(() => {
      expect(mockCreatePaymentRecord).toHaveBeenCalledTimes(1);
      expect(mockConfirmPayment).toHaveBeenCalledWith({ id: 'payment-1' });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '收款已确认到账',
        variant: 'success',
      })
    );
  });
});

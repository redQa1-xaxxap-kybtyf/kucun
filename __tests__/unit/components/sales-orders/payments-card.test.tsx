import { render, screen } from '@testing-library/react';

import { PaymentsCard } from '@/app/(dashboard)/sales-orders/[id]/components/PaymentsCard';
import type { SalesOrderDetail } from '@/app/(dashboard)/sales-orders/[id]/components/types';

function createOrder(overrides?: Partial<SalesOrderDetail>): SalesOrderDetail {
  return {
    id: 'sales-order-1',
    orderNumber: 'SO-2026-0824',
    customerId: 'customer-1',
    userId: 'user-1',
    status: 'completed',
    orderType: 'NORMAL',
    transferMode: 'SUPPLIER_ONLY',
    isSampleOrder: false,
    sampleSettlementType: 'FREE',
    itemsAmount: 108,
    additionalFees: 0,
    roundingAdjustment: 0,
    prepaymentAmount: 0,
    totalAmount: 108,
    costAmount: 60,
    profitAmount: 48,
    expenseAmount: 0,
    actualPaidAmount: 108,
    paymentRounding: 0,
    paidAmount: 108,
    remainingAmount: 0,
    remarks: '',
    createdAt: '2026-04-16T16:20:52.913Z',
    updatedAt: '2026-04-16T16:20:56.288Z',
    customer: {
      id: 'customer-1',
      name: '测试客户',
      phone: '13800000000',
      address: '上海市',
    },
    user: {
      id: 'user-1',
      name: '测试用户',
    },
    items: [],
    feeItems: [],
    paymentRecords: [
      {
        id: 'payment-confirmed-1',
        paymentNumber: 'SK-20260416-027',
        paymentAmount: 108,
        actualPaymentAmount: 108,
        roundingAmount: 0,
        paymentMethod: 'cash',
        paymentDate: '2026-04-17T00:00:00.000Z',
        status: 'confirmed',
        createdAt: '2026-04-16T16:20:56.151Z',
      },
    ],
    receivableConfirmationRecord: {
      id: 'payment-auto-1',
      paymentNumber: 'SK-20260416-026',
      paymentAmount: 108,
      actualPaymentAmount: 0,
      roundingAmount: 0,
      paymentMethod: 'cash',
      paymentDate: '2026-04-16T16:00:00.000Z',
      status: 'pending',
      remarks: '系统自动生成：销售订单 SO-2026-0824 确认应收',
      createdAt: '2026-04-16T16:20:52.913Z',
    },
    returnOrders: [],
    ...overrides,
  };
}

describe('PaymentsCard', () => {
  test('已收清订单的系统建账记录不应再显示为待确认收款', () => {
    render(<PaymentsCard order={createOrder()} />);

    expect(screen.getByText('应收已登记')).toBeInTheDocument();
    expect(screen.getByText('应收记录')).toBeInTheDocument();
    expect(
      screen.getByText('订单已结清，仅保留应收记录。')
    ).toBeInTheDocument();
    expect(screen.queryByText('待确认')).not.toBeInTheDocument();
    expect(screen.getByText('已确认')).toBeInTheDocument();
  });
});

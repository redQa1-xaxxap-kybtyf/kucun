import {
  allocatePurchaseOrderExpensesByQuantity,
  resolveInboundUnitCost,
} from '@/lib/services/purchase-order-cost-service';

describe('allocatePurchaseOrderExpensesByQuantity', () => {
  it('distributes expenses proportionally by quantity and keeps totals balanced', () => {
    const allocations = allocatePurchaseOrderExpensesByQuantity(
      [
        { id: 'a', quantity: 10, unitPrice: 5 },
        { id: 'b', quantity: 20, unitPrice: 6 },
      ],
      150
    );

    expect(allocations).toHaveLength(2);
    expect(allocations[0]).toMatchObject({
      id: 'a',
      allocatedExpense: 50,
      unitCostWithExpense: 10,
    });
    expect(allocations[1]).toMatchObject({
      id: 'b',
      allocatedExpense: 100,
      unitCostWithExpense: 11,
    });
    const totalAllocated = allocations.reduce(
      (sum, item) => sum + item.allocatedExpense,
      0
    );
    expect(totalAllocated).toBeCloseTo(150, 2);
  });

  it('handles rounding differences by redistributing remaining cents', () => {
    const sourceItems = [
      { id: 'a', quantity: 1, unitPrice: 10 },
      { id: 'b', quantity: 1, unitPrice: 12 },
      { id: 'c', quantity: 1, unitPrice: 8 },
    ];
    const allocations = allocatePurchaseOrderExpensesByQuantity(
      sourceItems,
      0.02
    );

    const allocatedValues = allocations.map(item => item.allocatedExpense);
    expect(allocatedValues.filter(value => value === 0.01)).toHaveLength(2);
    expect(allocatedValues.filter(value => value === 0)).toHaveLength(1);
    const totalAllocated = allocatedValues.reduce((sum, value) => sum + value, 0);
    expect(totalAllocated).toBeCloseTo(0.02, 5);

    const priceLookup = new Map(
      sourceItems.map(item => [item.id, item.unitPrice] as const)
    );
    allocations.forEach(item => {
      const unitPrice = priceLookup.get(item.id) ?? 0;
      expect(item.unitCostWithExpense).toBeCloseTo(unitPrice + 0.01, 2);
    });
  });

  it('throws when no purchase items are provided', () => {
    expect(() => allocatePurchaseOrderExpensesByQuantity([], 10)).toThrow(
      '采购订单至少需要一个明细进行费用分摊'
    );
  });
});

describe('resolveInboundUnitCost', () => {
  it('prefers unitCostWithExpense when available', () => {
    expect(
      resolveInboundUnitCost({
        unitCostWithExpense: 12.345,
        unitPrice: 9,
        fallback: 8,
      })
    ).toBe(12.35);
  });

  it('falls back to unit price when allocation is missing', () => {
    expect(
      resolveInboundUnitCost({
        unitCostWithExpense: null,
        unitPrice: 7.111,
        fallback: 6,
      })
    ).toBe(7.11);
  });

  it('uses fallback value as the last resort', () => {
    expect(
      resolveInboundUnitCost({
        unitCostWithExpense: undefined,
        unitPrice: undefined,
        fallback: 5.555,
      })
    ).toBe(5.56);
  });
});

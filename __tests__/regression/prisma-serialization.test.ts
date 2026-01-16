import { Prisma } from '@prisma/client';

import { replacePrismaDecimals } from '@/lib/utils/prisma-serialization';

function hasDecimalInstance(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(item => hasDecimalInstance(item));
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (value instanceof Date) {
    return false;
  }

  if (value.constructor?.name === 'Decimal') {
    return true;
  }

  return Object.values(value).some(nested => hasDecimalInstance(nested));
}

describe('replacePrismaDecimals', () => {
  it('replaces nested Prisma Decimal values with numbers', () => {
    const input = {
      totalAmount: new Prisma.Decimal('100.00'),
      costAmount: new Prisma.Decimal('12.34'),
      nested: {
        feeAmount: new Prisma.Decimal('5.50'),
      },
      items: [
        {
          unitPrice: new Prisma.Decimal('3.25'),
          totalPrice: new Prisma.Decimal('6.50'),
        },
      ],
      createdAt: new Date('2026-01-16T00:00:00.000Z'),
    };

    const output = replacePrismaDecimals(input) as unknown as {
      totalAmount: number;
      costAmount: number;
      nested: { feeAmount: number };
      items: Array<{ unitPrice: number; totalPrice: number }>;
      createdAt: Date;
    };

    expect(output.totalAmount).toBe(100);
    expect(output.costAmount).toBeCloseTo(12.34);
    expect(output.nested.feeAmount).toBe(5.5);
    expect(output.items[0]?.unitPrice).toBeCloseTo(3.25);
    expect(output.items[0]?.totalPrice).toBe(6.5);
    expect(output.createdAt instanceof Date).toBe(true);
    expect(hasDecimalInstance(output)).toBe(false);
  });
});


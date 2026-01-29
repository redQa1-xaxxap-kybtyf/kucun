import {
  buildExpenseWhere,
  applyReportVisibility,
} from '@/lib/services/report-helpers';

describe('report helpers: visibility + expense where regression', () => {
  test('applyReportVisibility: production 默认强制 dataTag=prod 且过滤 voidedAt=null', () => {
    const where: any = { foo: 1 };

    const out = applyReportVisibility(where, {
      systemMode: 'production',
    } as any);

    expect(out).toBe(where);
    expect(where.foo).toBe(1);
    expect(where.voidedAt).toBeNull();
    expect(where.dataTag).toBe('prod');
  });

  test('applyReportVisibility: production + includeTest=true 不应强制 dataTag=prod', () => {
    const where: any = {};

    applyReportVisibility(where, {
      systemMode: 'production',
      includeTest: true,
    } as any);

    expect(where.voidedAt).toBeNull();
    expect(where.dataTag).toBeUndefined();
  });

  test('applyReportVisibility: includeVoided=true 不应强制 voidedAt=null', () => {
    const where: any = {};

    applyReportVisibility(where, {
      systemMode: 'production',
      includeVoided: true,
    } as any);

    expect(where.voidedAt).toBeUndefined();
    expect(where.dataTag).toBe('prod');
  });

  test('buildExpenseWhere: 默认排除 relatedType=purchase_order 以避免费用重复扣减', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T23:59:59.999Z');

    const where = buildExpenseWhere(start, end) as any;

    expect(where.expenseDate).toEqual({ gte: start, lte: end });
    expect(where.relatedType).toEqual({ not: 'purchase_order' });
  });
});

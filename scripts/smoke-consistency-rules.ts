export {};

type PaginationCall = { take: number; skip: number };

type PaginationTracker = {
  label: string;
  calls: PaginationCall[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function asFiniteNumber(value: unknown, label: string): number {
  assert(typeof value === 'number', `${label} must be a number, got ${typeof value}`);
  assert(Number.isFinite(value), `${label} must be finite, got ${String(value)}`);
  return value;
}

function makeTracker(label: string): PaginationTracker {
  return { label, calls: [] };
}

function trackAndValidatePagination(
  tracker: PaginationTracker,
  args: unknown,
  expectedBatchSize: number
): { take: number; skip: number; callIndex: number } {
  assert(args && typeof args === 'object', `${tracker.label} args must be object`);
  const take = asFiniteNumber((args as any).take, `${tracker.label}.take`);
  const skip = asFiniteNumber((args as any).skip, `${tracker.label}.skip`);

  tracker.calls.push({ take, skip });
  const callIndex = tracker.calls.length;
  const expectedSkip = (callIndex - 1) * expectedBatchSize;

  assert(
    take === expectedBatchSize,
    `${tracker.label}.take expected ${expectedBatchSize}, got ${take}`
  );
  assert(
    skip === expectedSkip,
    `${tracker.label}.skip expected ${expectedSkip}, got ${skip}`
  );

  return { take, skip, callIndex };
}

function makePagedFindMany<T>(
  tracker: PaginationTracker,
  expectedBatchSize: number,
  expectedPages: number,
  makeRow: (rowIndex: number) => T
) {
  return async (args: unknown): Promise<T[]> => {
    const { take, skip, callIndex } = trackAndValidatePagination(
      tracker,
      args,
      expectedBatchSize
    );

    if (callIndex > expectedPages) return [];

    const rows: T[] = [];
    for (let i = 0; i < take; i++) rows.push(makeRow(skip + i));
    return rows;
  };
}

async function main() {
  process.env.DATABASE_URL ||= 'file:./dev.db';
  process.env.NEXTAUTH_SECRET ||= '12345678901234567890123456789012';
  process.env.STORAGE_ENCRYPTION_KEY ||= '12345678901234567890123456789012';

  const [{ prisma }, { CONSISTENCY_RULES }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/consistency/rules/index'),
  ]);

  const batchSize = 2;
  const maxRecords = 4;
  const expectedPages = 2;

  const inventoryFindManyTracker = makeTracker('prisma.inventory.findMany');
  const outboundFindManyTracker = makeTracker('prisma.outboundRecord.findMany');
  const salesOrderFindManyTracker = makeTracker('prisma.salesOrder.findMany(paged)');
  const statementFindManyTracker = makeTracker('prisma.accountStatement.findMany');
  const paymentFindManyTracker = makeTracker('prisma.paymentRecord.findMany');

  const prismaAny = prisma as any;

  prismaAny.inventory.findMany = makePagedFindMany(
    inventoryFindManyTracker,
    batchSize,
    expectedPages,
    (i: number) => ({
      id: `inv_${i}`,
      quantity: i === 0 ? -1 : 10,
      reservedQuantity: 0,
      updatedAt: new Date(),
    })
  );

  prismaAny.outboundRecord.findMany = makePagedFindMany(
    outboundFindManyTracker,
    batchSize,
    expectedPages,
    (i: number) => ({
      id: `out_${i}`,
      recordNumber: `OUT-${i}`,
      productId: `product_${i}`,
      variantId: `variant_${i}`,
      batchNumber: `batch_${i}`,
      inventoryId: `inv_${i}`,
      quantity: i === 0 ? 999 : 5,
      unitCost: 10,
      totalCost: 50,
      salesOrderId: `so_${i}`,
      reason: 'sale',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  prismaAny.salesOrder.findMany = async (args: any) => {
    const isPagedCall = typeof args?.take === 'number' && typeof args?.skip === 'number';
    if (isPagedCall) {
      return await makePagedFindMany(
        salesOrderFindManyTracker,
        batchSize,
        expectedPages,
        (i: number) => ({
          id: `so_ship_${i}`,
          orderNumber: `SO-SHIP-${i}`,
          status: 'shipped',
          totalAmount: 100,
          itemsAmount: 100,
          shippedAt: new Date(),
          costAmount: null,
          updatedAt: new Date(),
          items: [
            {
              id: `item_${i}_1`,
              productId: 'p1',
              variantId: 'v1',
              unitCost: null,
            },
          ],
        })
      )(args);
    }

    return [
      {
        id: 'so_calc_1',
        orderNumber: 'SO-CALC-1',
        status: 'confirmed',
        totalAmount: 100,
        itemsAmount: 100,
        paidAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  };

  prismaAny.accountStatement.findMany = makePagedFindMany(
    statementFindManyTracker,
    batchSize,
    expectedPages,
    (i: number) => ({
      id: `stmt_${i}`,
      entityId: `customer_${i}`,
      entityName: 'Customer',
      entityDisplayName: `客户${i}`,
      partnerRole: 'customer',
      totalOrders: 1,
      totalAmount: 100,
      paidAmount: 0,
      pendingAmount: 100,
      currentBalance: 100,
      lastTransactionDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  prismaAny.paymentRecord.findMany = makePagedFindMany(
    paymentFindManyTracker,
    batchSize,
    expectedPages,
    (i: number) => ({
      id: `pay_${i}`,
      paymentNumber: `PAY-${i}`,
      customerId: `customer_${i}`,
      paymentType: 'payment',
      paymentAmount: 10,
      actualPaymentAmount: 10,
      appliedAmount: 0,
      status: 'confirmed',
      paymentDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  );

  prismaAny.inventory.findFirst = async () => ({
    id: 'inv_lookup',
    quantity: 10,
    reservedQuantity: 0,
    updatedAt: new Date(),
  });

  prismaAny.outboundRecord.count = async () => 0;

  prismaAny.accountStatement.findFirst = async () => ({
    id: 'stmt_lookup',
    currentBalance: 100,
    totalAmount: 100,
    paidAmount: 0,
    lastTransactionDate: new Date(0),
    updatedAt: new Date(),
  });

  prismaAny.inventoryCostQueue.aggregate = async () => ({
    _sum: { remainingQty: 0 },
  });

  prismaAny.$queryRaw = async () => [
    {
      sku_id: 'sku_1',
      product_id: 'p1',
      variant_id: 'v1',
      batch_number: 'b1',
      change_type: 'outbound',
      last_updated: new Date(),
    },
  ];

  for (const rule of CONSISTENCY_RULES) {
    await rule.check({ batchSize, maxRecords, dryRun: true });
  }

  const trackers = [
    inventoryFindManyTracker,
    outboundFindManyTracker,
    salesOrderFindManyTracker,
    statementFindManyTracker,
    paymentFindManyTracker,
  ];

  for (const tracker of trackers) {
    assert(
      tracker.calls.length === expectedPages,
      `${tracker.label} expected ${expectedPages} pages, got ${tracker.calls.length}`
    );
  }

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log('✅ smoke-consistency-rules ok');
}

main().catch(error => {
  // eslint-disable-next-line no-console
  console.error('❌ smoke-consistency-rules failed:', error);
  process.exitCode = 1;
});

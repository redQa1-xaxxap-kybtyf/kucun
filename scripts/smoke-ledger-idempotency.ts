export {};

import { randomUUID } from 'crypto';

import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const DESIRED_CONNECTION_LIMIT = 15;
const DESIRED_POOL_TIMEOUT_SECONDS = 60;

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const connectionLimit = Number(
      url.searchParams.get('connection_limit') ?? '0'
    );
    const poolTimeout = Number(url.searchParams.get('pool_timeout') ?? '0');

    if (!connectionLimit || connectionLimit < DESIRED_CONNECTION_LIMIT) {
      url.searchParams.set(
        'connection_limit',
        String(DESIRED_CONNECTION_LIMIT)
      );
    }

    if (!poolTimeout || poolTimeout < DESIRED_POOL_TIMEOUT_SECONDS) {
      url.searchParams.set(
        'pool_timeout',
        String(DESIRED_POOL_TIMEOUT_SECONDS)
      );
    }

    process.env.DATABASE_URL = url.toString();
  } catch {
    // ignore malformed DATABASE_URL and rely on env default
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const [{ prisma }, { recordPartnerTransaction }] = await Promise.all([
    import('@/lib/db'),
    import('@/lib/services/partner-ledger-service'),
  ]);

  const runId = randomUUID();
  const customerName = `smoke-ledger-${runId}`;

  let customerId: string | null = null;
  let referenceId: string | null = null;
  let transactionType: 'sale' | null = null;

  try {
    const customer = await prisma.customer.create({
      data: {
        name: customerName,
        role: 'customer',
      },
    });
    customerId = customer.id;

    await prisma.accountStatement.create({
      data: {
        entityId: customer.id,
        entityName: customer.name,
        entityType: 'customer',
        partnerRole: 'customer',
        status: 'active',
        lastTransactionDate: new Date(),
      },
    });

    referenceId = randomUUID();
    transactionType = 'sale';

    const input = {
      partnerId: customer.id,
      partnerName: customer.name,
      partnerRole: 'customer' as const,
      entityType: 'customer' as const,
      transactionType,
      amount: 1,
      referenceId,
      referenceNumber: `SMOKE-${referenceId.slice(0, 8)}`,
      description: 'smoke ledger idempotency',
      occurredAt: new Date(),
      status: 'completed' as const,
      metadata: { runId, source: 'scripts/smoke-ledger-idempotency.ts' },
    };

    const seeded = await recordPartnerTransaction(input);

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        prisma.$transaction(tx => recordPartnerTransaction(input, tx), {
          maxWait: 30_000,
          timeout: 30_000,
        })
      )
    );

    const uniqueTransactionIds = new Set(
      [seeded, ...results].map(row => row.id)
    );
    const count = await prisma.statementTransaction.count({
      where: {
        referenceId,
        transactionType,
      },
    });

    assert(count === 1, `[smoke] expected count=1, got count=${count}`);
    assert(
      uniqueTransactionIds.size === 1,
      `[smoke] expected 1 transaction id, got ${uniqueTransactionIds.size}`
    );

    // eslint-disable-next-line no-console
    console.log('✅ smoke-ledger-idempotency ok', {
      runId,
      referenceId,
      transactionType,
      transactionId: [...uniqueTransactionIds][0],
    });
  } finally {
    if (referenceId && transactionType) {
      await prisma.statementTransaction
        .deleteMany({ where: { referenceId, transactionType } })
        .catch(() => undefined);
    }

    if (customerId) {
      await prisma.accountStatement
        .deleteMany({ where: { entityId: customerId } })
        .catch(() => undefined);
      await prisma.customer
        .delete({ where: { id: customerId } })
        .catch(() => undefined);
    }

    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    // eslint-disable-next-line no-console
    console.error('❌ smoke-ledger-idempotency failed:', error);
    process.exit(1);
  });

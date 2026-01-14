import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  const runId = randomUUID();

  try {
    await prisma.auditRun.create({
      data: {
        runId,
        auditKey: 'smoke',
        status: 'running',
        startedAt: new Date(),
        configJson: { source: 'scripts/smoke-prisma-audit.ts' },
      },
    });

    const row = await prisma.auditRun.findUnique({ where: { runId } });
    if (!row) throw new Error('AuditRun 创建后未能读取到记录');

    console.log(`[smoke] auditRun OK runId=${runId} status=${row.status}`);
  } finally {
    await prisma.auditRun.deleteMany({ where: { runId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('[smoke] auditRun FAILED', err);
  process.exitCode = 1;
});


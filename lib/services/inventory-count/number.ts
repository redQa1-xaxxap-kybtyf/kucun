import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

/**
 * 生成盘点编号
 * 格式：COUNT-YYYYMMDD-序号
 */
export async function generateCountNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const db = tx || prisma;
  const now = new Date();
  const dateStr = buildDateString(now);
  const prefix = `COUNT-${dateStr}-`;

  const lastRecord = await db.inventoryCount.findFirst({
    where: {
      countNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      countNumber: 'desc',
    },
    select: {
      countNumber: true,
    },
  });

  const sequence = lastRecord
    ? parseSequence(lastRecord.countNumber, prefix) + 1
    : 1;

  const sequenceStr = String(sequence).padStart(3, '0');
  return `${prefix}${sequenceStr}`;
}

function buildDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function parseSequence(countNumber: string, prefix: string): number {
  const sequence = parseInt(countNumber.substring(prefix.length), 10);
  return Number.isNaN(sequence) ? 0 : sequence;
}

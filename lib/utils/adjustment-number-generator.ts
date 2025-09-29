/**
 * 库存调整单号生成器
 * 生成格式：TZ-YYYYMMDD-序号
 */

import { prisma } from '@/lib/db';

/**
 * 生成库存调整单号
 * @returns 调整单号，格式：TZ-YYYYMMDD-序号
 */
export async function generateAdjustmentNumber(): Promise<string> {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `TZ-${dateKey}`;

  // 使用事务确保序号的唯一性
  const result = await prisma.$transaction(async tx => {
    // 查找或创建当天的序号记录
    const sequence = await tx.orderSequence.upsert({
      where: {
        sequenceType_dateKey: {
          sequenceType: 'adjustment',
          dateKey,
        },
      },
      update: {
        currentSequence: {
          increment: 1,
        },
      },
      create: {
        sequenceType: 'adjustment',
        dateKey,
        currentSequence: 1,
      },
    });

    // 生成完整的调整单号
    const sequenceNumber = sequence.currentSequence.toString().padStart(3, '0');
    return `${prefix}-${sequenceNumber}`;
  });

  return result;
}

/**
 * 验证调整单号格式
 * @param adjustmentNumber 调整单号
 * @returns 是否为有效格式
 */
export function validateAdjustmentNumber(adjustmentNumber: string): boolean {
  const pattern = /^TZ-\d{8}-\d{3}$/;
  return pattern.test(adjustmentNumber);
}

/**
 * 解析调整单号
 * @param adjustmentNumber 调整单号
 * @returns 解析结果
 */
export function parseAdjustmentNumber(adjustmentNumber: string): {
  isValid: boolean;
  date?: string;
  sequence?: number;
} {
  if (!validateAdjustmentNumber(adjustmentNumber)) {
    return { isValid: false };
  }

  const parts = adjustmentNumber.split('-');
  const dateStr = parts[1]; // YYYYMMDD
  const sequenceStr = parts[2]; // 序号

  // 格式化日期为 YYYY-MM-DD
  const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  const sequence = parseInt(sequenceStr, 10);

  return {
    isValid: true,
    date,
    sequence,
  };
}

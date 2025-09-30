/**
 * 收款记录号和付款记录号生成器
 * 使用数据库序列表确保并发安全
 * 严格遵循全局约定规范
 */

import { prisma } from '@/lib/db';

/**
 * 生成收款记录号
 * @returns 收款记录号,格式: SK-YYYYMMDD-XXX
 */
export async function generatePaymentNumber(): Promise<string> {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `SK-${dateKey}`;

  // 使用事务确保序号的唯一性
  const result = await prisma.$transaction(async tx => {
    // 查找或创建当天的序号记录
    const sequence = await tx.orderSequence.upsert({
      where: {
        sequenceType_dateKey: {
          sequenceType: 'payment',
          dateKey,
        },
      },
      update: {
        currentSequence: {
          increment: 1,
        },
      },
      create: {
        sequenceType: 'payment',
        dateKey,
        currentSequence: 1,
      },
    });

    // 生成完整的收款记录号
    const sequenceNumber = sequence.currentSequence.toString().padStart(3, '0');
    return `${prefix}-${sequenceNumber}`;
  });

  return result;
}

/**
 * 生成付款记录号
 * @returns 付款记录号,格式: FK-YYYYMMDD-XXX
 */
export async function generatePaymentOutNumber(): Promise<string> {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `FK-${dateKey}`;

  // 使用事务确保序号的唯一性
  const result = await prisma.$transaction(async tx => {
    // 查找或创建当天的序号记录
    const sequence = await tx.orderSequence.upsert({
      where: {
        sequenceType_dateKey: {
          sequenceType: 'payment_out',
          dateKey,
        },
      },
      update: {
        currentSequence: {
          increment: 1,
        },
      },
      create: {
        sequenceType: 'payment_out',
        dateKey,
        currentSequence: 1,
      },
    });

    // 生成完整的付款记录号
    const sequenceNumber = sequence.currentSequence.toString().padStart(3, '0');
    return `${prefix}-${sequenceNumber}`;
  });

  return result;
}

/**
 * 生成应付款记录号
 * @returns 应付款记录号,格式: YFK-YYYYMMDD-XXX
 */
export async function generatePayableNumber(): Promise<string> {
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `YFK-${dateKey}`;

  // 使用事务确保序号的唯一性
  const result = await prisma.$transaction(async tx => {
    // 查找或创建当天的序号记录
    const sequence = await tx.orderSequence.upsert({
      where: {
        sequenceType_dateKey: {
          sequenceType: 'payable',
          dateKey,
        },
      },
      update: {
        currentSequence: {
          increment: 1,
        },
      },
      create: {
        sequenceType: 'payable',
        dateKey,
        currentSequence: 1,
      },
    });

    // 生成完整的应付款记录号
    const sequenceNumber = sequence.currentSequence.toString().padStart(3, '0');
    return `${prefix}-${sequenceNumber}`;
  });

  return result;
}


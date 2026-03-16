/**
 * 修复产品的 piecesPerUnit 字段
 * 将默认值从 1 更新为 10（根据实际业务需求调整）
 */

import * as readline from 'readline';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function fixPiecesPerUnit() {
  console.log('开始修复产品的 piecesPerUnit 字段...\n');

  try {
    const abnormalWhere = { piecesPerUnit: 1 } as const;
    const totalAbnormal = await prisma.product.count({ where: abnormalWhere });

    if (totalAbnormal === 0) {
      console.log('✅ 没有需要修复的产品！');
      rl.close();
      return;
    }

    console.log(`找到 ${totalAbnormal} 个需要修复的产品\n`);

    console.log('\n请为每个产品输入正确的 piecesPerUnit 值：');
    console.log('（提示：10 表示每件10片，直接回车跳过该产品）\n');

    const batchSize = 20;
    let lastId: string | undefined;

    while (true) {
      const products = await prisma.product.findMany({
        where: {
          ...abnormalWhere,
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          code: true,
          name: true,
          piecesPerUnit: true,
        },
      });

      if (products.length === 0) {
        break;
      }

      for (const product of products) {
        const answer = await question(
          `${product.code} (${product.name}) 的每件片数 [默认10]: `
        );

        const newValue = answer.trim() === '' ? 10 : parseInt(answer.trim());

        if (isNaN(newValue) || newValue <= 0) {
          console.log(`  ⚠️  跳过 ${product.code}（输入无效）\n`);
          continue;
        }

        await prisma.product.update({
          where: { id: product.id },
          data: { piecesPerUnit: newValue },
        });

        console.log(
          `  ✅ 已更新 ${product.code}: piecesPerUnit = ${newValue}\n`
        );
      }

      lastId = products[products.length - 1].id;
    }

    console.log('\n✅ 修复完成！');

    // 验证结果
    const remaining = await prisma.product.count({
      where: abnormalWhere,
    });

    if (remaining > 0) {
      console.log(`⚠️  仍有 ${remaining} 个产品的 piecesPerUnit 为 1`);
    } else {
      console.log('✅ 所有产品的 piecesPerUnit 值已正常！');
    }
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

fixPiecesPerUnit();

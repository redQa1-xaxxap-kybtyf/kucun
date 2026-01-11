/**
 * 批量修复产品的 piecesPerUnit 字段
 * 将 piecesPerUnit = 1 的产品批量更新为 10
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function batchFixPiecesPerUnit() {
  console.log('开始批量修复产品的 piecesPerUnit 字段...\n');

  try {
    const abnormalWhere = { piecesPerUnit: 1 } as const;
    const totalAbnormal = await prisma.product.count({ where: abnormalWhere });

    if (totalAbnormal === 0) {
      console.log('✅ 没有需要修复的产品！');
      return;
    }

    const sampleSize = 50;
    const abnormalSample = await prisma.product.findMany({
      where: abnormalWhere,
      orderBy: { id: 'asc' },
      take: sampleSize,
      select: {
        id: true,
        code: true,
        name: true,
        piecesPerUnit: true,
      },
    });

    console.log(`找到 ${totalAbnormal} 个需要修复的产品：\n`);
    abnormalSample.forEach(p => {
      console.log(`  - ${p.code} (${p.name})`);
    });

    if (totalAbnormal > abnormalSample.length) {
      console.log(`  ... 还有 ${totalAbnormal - abnormalSample.length} 个未显示`);
    }

    // 批量更新为 10
    const result = await prisma.product.updateMany({
      where: abnormalWhere,
      data: {
        piecesPerUnit: 10,
      },
    });

    console.log(
      `\n✅ 成功更新 ${result.count} 个产品的 piecesPerUnit 值为 10！`
    );

    // 验证结果
    const remaining = await prisma.product.count({
      where: { piecesPerUnit: 1 },
    });

    if (remaining > 0) {
      console.log(`⚠️  仍有 ${remaining} 个产品的 piecesPerUnit 为 1`);
    } else {
      console.log('✅ 所有产品的 piecesPerUnit 值已正常！');
    }

    // 显示更新后的产品信息
    console.log('\n更新后的产品信息：');
    const updatedProducts = await prisma.product.findMany({
      where: {
        id: { in: abnormalSample.map(p => p.id) },
      },
      orderBy: { id: 'asc' },
      take: sampleSize,
      select: {
        code: true,
        name: true,
        piecesPerUnit: true,
      },
    });

    updatedProducts.forEach(p => {
      console.log(
        `  - ${p.code} (${p.name}): piecesPerUnit = ${p.piecesPerUnit}`
      );
    });
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

batchFixPiecesPerUnit();

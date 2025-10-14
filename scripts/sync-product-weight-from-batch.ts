/**
 * 同步批次规格中的weight到产品表
 *
 * 问题：入库时的weight数据只保存到BatchSpecification表，没有同步到Product表
 * 解决：将批次规格中的weight同步到对应的产品
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncProductWeightFromBatch() {
  console.log('开始同步产品重量数据...\n');

  try {
    // 1. 查找所有没有weight的产品
    const productsWithoutWeight = await prisma.product.findMany({
      where: {
        OR: [{ weight: null }, { weight: 0 }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        weight: true,
        piecesPerUnit: true,
      },
    });

    console.log(`找到 ${productsWithoutWeight.length} 个没有重量数据的产品\n`);

    let updatedCount = 0;
    let skippedCount = 0;

    // 2. 对每个产品，查找其批次规格中的weight
    for (const product of productsWithoutWeight) {
      // 查找该产品的最新批次规格（有weight的）
      const batchSpec = await prisma.batchSpecification.findFirst({
        where: {
          productId: product.id,
          weight: {
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          weight: true,
          piecesPerUnit: true,
          batchNumber: true,
        },
      });

      if (batchSpec && batchSpec.weight) {
        // 更新产品的weight
        await prisma.product.update({
          where: { id: product.id },
          data: {
            weight: batchSpec.weight,
            // 同时更新piecesPerUnit（如果产品的piecesPerUnit是默认值1）
            ...(product.piecesPerUnit === 1 && batchSpec.piecesPerUnit > 1
              ? { piecesPerUnit: batchSpec.piecesPerUnit }
              : {}),
          },
        });

        console.log(`✅ 更新产品: ${product.code} - ${product.name}`);
        console.log(
          `   重量: ${batchSpec.weight}kg (从批次 ${batchSpec.batchNumber} 同步)`
        );
        if (product.piecesPerUnit === 1 && batchSpec.piecesPerUnit > 1) {
          console.log(`   每件片数: ${batchSpec.piecesPerUnit}`);
        }
        console.log('');

        updatedCount++;
      } else {
        console.log(
          `⚠️  跳过产品: ${product.code} - ${product.name} (没有找到批次规格数据)`
        );
        skippedCount++;
      }
    }

    console.log('\n同步完成！');
    console.log(`✅ 成功更新: ${updatedCount} 个产品`);
    console.log(`⚠️  跳过: ${skippedCount} 个产品`);

    // 3. 验证结果
    const remainingProductsWithoutWeight = await prisma.product.count({
      where: {
        OR: [{ weight: null }, { weight: 0 }],
      },
    });

    console.log(`\n还有 ${remainingProductsWithoutWeight} 个产品没有重量数据`);
  } catch (error) {
    console.error('同步失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
syncProductWeightFromBatch()
  .then(() => {
    console.log('\n✅ 脚本执行成功');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

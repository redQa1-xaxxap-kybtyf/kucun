/**
 * 批次规格参数数据迁移脚本
 * 将现有产品的规格参数迁移到批次级别管理
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationResult {
  success: boolean;
  message: string;
  details?: {
    productsProcessed: number;
    batchSpecsCreated: number;
    inboundRecordsUpdated: number;
  };
}

/**
 * 生成默认批次号
 */
function generateDefaultBatchNumber(productCode: string): string {
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${productCode}-DEFAULT-${today}`;
}

/**
 * 迁移产品规格参数到批次级别
 */
async function migrateBatchSpecifications(): Promise<MigrationResult> {
  try {
    console.log('🚀 开始迁移批次规格参数...');

    // 1. 获取所有活跃产品
    const products = await prisma.product.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        piecesPerUnit: true,
        weight: true,
        thickness: true,
      },
    });

    console.log(`📦 找到 ${products.length} 个活跃产品需要迁移`);

    let batchSpecsCreated = 0;
    let inboundRecordsUpdated = 0;

    // 2. 为每个产品创建默认批次规格参数
    for (const product of products) {
      console.log(`处理产品: ${product.name} (${product.code})`);

      // 获取该产品的所有入库记录，按批次号分组
      const inboundRecords = await prisma.inboundRecord.findMany({
        where: { productId: product.id },
        select: {
          id: true,
          batchNumber: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      // 收集唯一的批次号
      const uniqueBatches = new Set<string>();

      for (const record of inboundRecords) {
        const batchNumber =
          record.batchNumber || generateDefaultBatchNumber(product.code);
        uniqueBatches.add(batchNumber);
      }

      // 如果没有入库记录，创建一个默认批次
      if (uniqueBatches.size === 0) {
        uniqueBatches.add(generateDefaultBatchNumber(product.code));
      }

      // 3. 为每个批次创建规格参数记录
      for (const batchNumber of uniqueBatches) {
        try {
          const batchSpec = await prisma.batchSpecification.upsert({
            where: {
              productId_batchNumber: {
                productId: product.id,
                batchNumber,
              },
            },
            update: {
              piecesPerUnit: product.piecesPerUnit,
              weight: product.weight,
              thickness: product.thickness,
            },
            create: {
              productId: product.id,
              batchNumber,
              piecesPerUnit: product.piecesPerUnit,
              weight: product.weight,
              thickness: product.thickness,
            },
          });

          batchSpecsCreated++;
          console.log(`  ✅ 创建批次规格: ${batchNumber}`);

          // 4. 更新相关的入库记录，关联到批次规格参数
          const updateResult = await prisma.inboundRecord.updateMany({
            where: {
              productId: product.id,
              batchNumber:
                batchNumber === generateDefaultBatchNumber(product.code)
                  ? null
                  : batchNumber,
              batchSpecificationId: null, // 只更新未关联的记录
            },
            data: {
              batchSpecificationId: batchSpec.id,
              // 如果原来没有批次号，设置为默认批次号
              ...(batchNumber === generateDefaultBatchNumber(product.code) && {
                batchNumber,
              }),
            },
          });

          inboundRecordsUpdated += updateResult.count;
          console.log(`  📝 更新 ${updateResult.count} 条入库记录`);
        } catch (error) {
          console.error(`  ❌ 处理批次 ${batchNumber} 失败:`, error);
        }
      }
    }

    // 5. 验证迁移结果
    const totalBatchSpecs = await prisma.batchSpecification.count();
    const unlinkedRecords = await prisma.inboundRecord.count({
      where: { batchSpecificationId: null },
    });

    console.log('\n📊 迁移结果统计:');
    console.log(`  - 处理产品数量: ${products.length}`);
    console.log(`  - 创建批次规格参数: ${batchSpecsCreated}`);
    console.log(`  - 更新入库记录: ${inboundRecordsUpdated}`);
    console.log(`  - 总批次规格参数: ${totalBatchSpecs}`);
    console.log(`  - 未关联入库记录: ${unlinkedRecords}`);

    if (unlinkedRecords > 0) {
      console.warn(
        `⚠️  警告: 仍有 ${unlinkedRecords} 条入库记录未关联到批次规格参数`
      );
    }

    return {
      success: true,
      message: '批次规格参数迁移完成',
      details: {
        productsProcessed: products.length,
        batchSpecsCreated,
        inboundRecordsUpdated,
      },
    };
  } catch (error) {
    console.error('❌ 迁移失败:', error);
    return {
      success: false,
      message: `迁移失败: ${error instanceof Error ? error.message : '未知错误'}`,
    };
  }
}

/**
 * 验证迁移结果
 */
async function validateMigration(): Promise<void> {
  console.log('\n🔍 验证迁移结果...');

  // 检查数据一致性
  const products = await prisma.product.findMany({
    where: { status: 'active' },
    include: {
      batchSpecifications: true,
      inboundRecords: {
        include: {
          batchSpecification: true,
        },
      },
    },
  });

  for (const product of products) {
    console.log(`\n产品: ${product.name} (${product.code})`);
    console.log(`  - 批次规格参数数量: ${product.batchSpecifications.length}`);
    console.log(`  - 入库记录数量: ${product.inboundRecords.length}`);

    const linkedRecords = product.inboundRecords.filter(
      r => r.batchSpecificationId
    );
    console.log(`  - 已关联入库记录: ${linkedRecords.length}`);

    if (linkedRecords.length !== product.inboundRecords.length) {
      console.warn(
        `  ⚠️  有 ${product.inboundRecords.length - linkedRecords.length} 条入库记录未关联`
      );
    }
  }
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  try {
    const result = await migrateBatchSpecifications();

    if (result.success) {
      console.log(`\n✅ ${result.message}`);
      await validateMigration();
    } else {
      console.error(`\n❌ ${result.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('脚本执行失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行迁移
if (require.main === module) {
  main();
}

export { migrateBatchSpecifications, validateMigration };

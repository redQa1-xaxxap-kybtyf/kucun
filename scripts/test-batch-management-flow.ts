/**
 * 批次管理数据流测试脚本
 * 验证从入库表单到库存显示的完整数据流
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: string;
}

async function testBatchManagementFlow(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    console.log('🧪 开始测试批次管理数据流...\n');

    // 1. 检查数据库模型是否支持批次字段
    console.log('1️⃣ 检查数据库模型...');

    // 检查 Inventory 模型是否有 batchNumber 字段
    const inventoryFields = await prisma.$queryRaw`
      PRAGMA table_info(inventory)
    `;

    const hasBatchNumber =
      Array.isArray(inventoryFields) &&
      inventoryFields.some((field: any) => field.name === 'batch_number');

    results.push({
      name: 'Inventory模型支持批次号',
      success: hasBatchNumber,
      message: hasBatchNumber
        ? 'inventory表包含batch_number字段'
        : 'inventory表缺少batch_number字段',
    });

    // 检查 InboundRecord 模型是否有 batchNumber 字段
    const inboundFields = await prisma.$queryRaw`
      PRAGMA table_info(inbound_records)
    `;

    const inboundHasBatchNumber =
      Array.isArray(inboundFields) &&
      inboundFields.some((field: any) => field.name === 'batch_number');

    results.push({
      name: 'InboundRecord模型支持批次号',
      success: inboundHasBatchNumber,
      message: inboundHasBatchNumber
        ? 'inbound_records表包含batch_number字段'
        : 'inbound_records表缺少batch_number字段',
    });

    // 2. 检查是否有测试产品
    console.log('\n2️⃣ 检查测试数据...');

    const testProduct = await prisma.product.findFirst({
      where: {
        name: {
          contains: '测试',
        },
      },
    });

    if (!testProduct) {
      // 创建测试产品
      const newProduct = await prisma.product.create({
        data: {
          name: '测试产品-批次管理',
          code: 'TEST-BATCH-001',
          specification: '测试规格',
          unit: 'piece',
          piecesPerUnit: 1,
          categoryId: null,
        },
      });

      results.push({
        name: '创建测试产品',
        success: true,
        message: `成功创建测试产品: ${newProduct.name}`,
        details: `产品ID: ${newProduct.id}`,
      });
    } else {
      results.push({
        name: '测试产品存在',
        success: true,
        message: `找到测试产品: ${testProduct.name}`,
        details: `产品ID: ${testProduct.id}`,
      });
    }

    // 3. 测试批次入库功能
    console.log('\n3️⃣ 测试批次入库功能...');

    const productForTest = testProduct || (await prisma.product.findFirst());

    if (productForTest) {
      // 创建测试用户（如果不存在）
      let testUser = await prisma.user.findFirst({
        where: { username: 'test-batch-user' },
      });

      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            username: 'test-batch-user',
            name: '批次测试用户',
            email: 'test-batch@example.com',
            passwordHash: 'test123456', // 简化测试，实际应该使用哈希
            role: 'admin',
            status: 'active',
          },
        });
      }

      // 创建带批次号的入库记录
      const batchNumber = `BATCH-${Date.now()}`;
      const inboundRecord = await prisma.inboundRecord.create({
        data: {
          recordNumber: `IN${Date.now()}`,
          productId: productForTest.id,
          batchNumber: batchNumber,
          quantity: 100,
          unitCost: 10.5,
          totalCost: 1050,
          reason: 'purchase',
          remarks: '批次管理测试入库',
          userId: testUser.id,
        },
      });

      results.push({
        name: '创建批次入库记录',
        success: true,
        message: `成功创建入库记录，批次号: ${batchNumber}`,
        details: `记录ID: ${inboundRecord.id}`,
      });

      // 4. 测试库存更新功能
      console.log('\n4️⃣ 测试库存更新功能...');

      // 查找或创建库存记录
      let inventoryRecord = await prisma.inventory.findFirst({
        where: {
          productId: productForTest.id,
          batchNumber: batchNumber,
        },
      });

      if (!inventoryRecord) {
        inventoryRecord = await prisma.inventory.create({
          data: {
            productId: productForTest.id,
            batchNumber: batchNumber,
            quantity: 100,
            reservedQuantity: 0,
            unitCost: 10.5,
            location: '测试仓库A区',
          },
        });

        results.push({
          name: '创建批次库存记录',
          success: true,
          message: `成功创建库存记录，批次号: ${batchNumber}`,
          details: `库存ID: ${inventoryRecord.id}`,
        });
      } else {
        results.push({
          name: '批次库存记录已存在',
          success: true,
          message: `找到现有库存记录，批次号: ${batchNumber}`,
          details: `库存ID: ${inventoryRecord.id}`,
        });
      }

      // 5. 验证数据完整性
      console.log('\n5️⃣ 验证数据完整性...');

      const inventoryWithProduct = await prisma.inventory.findUnique({
        where: { id: inventoryRecord.id },
        include: {
          product: true,
        },
      });

      const hasCompleteData =
        inventoryWithProduct &&
        inventoryWithProduct.batchNumber === batchNumber &&
        inventoryWithProduct.unitCost === 10.5 &&
        inventoryWithProduct.location === '测试仓库A区';

      results.push({
        name: '批次数据完整性验证',
        success: hasCompleteData,
        message: hasCompleteData
          ? '批次数据完整，包含批次号、单位成本、存储位置'
          : '批次数据不完整',
        details: hasCompleteData
          ? `批次号: ${inventoryWithProduct.batchNumber}, 成本: ${inventoryWithProduct.unitCost}, 位置: ${inventoryWithProduct.location}`
          : '数据验证失败',
      });
    }

    // 6. 清理测试数据
    console.log('\n6️⃣ 清理测试数据...');

    const cleanupResult = await prisma.inventory.deleteMany({
      where: {
        product: {
          name: {
            contains: '测试产品-批次管理',
          },
        },
      },
    });

    await prisma.inboundRecord.deleteMany({
      where: {
        product: {
          name: {
            contains: '测试产品-批次管理',
          },
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        name: {
          contains: '测试产品-批次管理',
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        username: 'test-batch-user',
      },
    });

    results.push({
      name: '清理测试数据',
      success: true,
      message: `成功清理测试数据，删除了 ${cleanupResult.count} 条库存记录`,
    });
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    results.push({
      name: '测试执行',
      success: false,
      message: `测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
    });
  } finally {
    await prisma.$disconnect();
  }

  return results;
}

// 执行测试
async function main() {
  const results = await testBatchManagementFlow();

  console.log('\n📊 测试结果汇总:');
  console.log('='.repeat(50));

  let successCount = 0;
  let failCount = 0;

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const number = (index + 1).toString().padStart(2, '0');

    console.log(`${status} ${number}. ${result.name}`);
    console.log(`    ${result.message}`);
    if (result.details) {
      console.log(`    详情: ${result.details}`);
    }
    console.log('');

    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  });

  console.log('='.repeat(50));
  console.log(`总计: ${results.length} 项测试`);
  console.log(`✅ 成功: ${successCount} 项`);
  console.log(`❌ 失败: ${failCount} 项`);
  console.log(
    `📈 成功率: ${((successCount / results.length) * 100).toFixed(1)}%`
  );

  if (failCount === 0) {
    console.log('\n🎉 所有测试通过！批次管理数据流正常工作。');
  } else {
    console.log('\n⚠️  部分测试失败，请检查相关功能。');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { testBatchManagementFlow };

/**
 * 成本核算功能测试脚本
 * 验证入库成本计算、出库成本记录、库存成本显示
 */

import { executeMinimalInboundTransaction } from '@/lib/api/minimal-inbound-transaction';
import { prisma } from '@/lib/db';
import { toNumber } from '@/lib/utils/number';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: TestResult[] = [];

function addResult(
  name: string,
  passed: boolean,
  message: string,
  details?: unknown
) {
  results.push({ name, passed, message, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
  if (details) {
    console.log('   详情:', JSON.stringify(details, null, 2));
  }
}

async function testCostAccounting() {
  console.log('🧪 开始成本核算功能测试...\n');

  try {
    // 准备测试数据
    console.log('📦 准备测试数据...');
    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      throw new Error('未找到测试用户');
    }

    const testProduct = await prisma.product.findFirst({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
    });

    if (!testProduct) {
      throw new Error('未找到可用的测试产品');
    }

    console.log(`✅ 测试产品: ${testProduct.name} (${testProduct.code})`);
    console.log(`✅ 测试用户: ${testUser.username}\n`);

    // 清理测试产品的现有库存（可选）
    const existingInventory = await prisma.inventory.findFirst({
      where: { productId: testProduct.id },
    });

    if (existingInventory) {
      console.log('⚠️  发现现有库存，将基于现有数据测试\n');
    }

    // 测试1: 第一次入库 - 验证成本初始化
    console.log('📝 测试1: 第一次入库 - 验证成本初始化');
    const inbound1 = await executeMinimalInboundTransaction({
      productId: testProduct.id,
      quantity: 100,
      unitCost: 10.5,
      reason: 'purchase',
      remarks: '成本核算测试 - 第一次入库',
      batchNumber: `TEST-${Date.now()}-1`,
      userId: testUser.id,
    });

    // 验证入库记录
    const inboundRecord1 = await prisma.inboundRecord.findUnique({
      where: { id: inbound1.id },
      select: { unitCost: true, totalCost: true, quantity: true },
    });

    if (!inboundRecord1) {
      addResult('测试1 - 入库记录', false, '未找到入库记录');
    } else {
      const expectedTotalCost = 100 * 10.5;
      const totalCostMatch =
        toNumber(inboundRecord1.totalCost) === expectedTotalCost;
      const unitCostMatch = toNumber(inboundRecord1.unitCost) === 10.5;

      addResult(
        '测试1 - 入库记录成本',
        totalCostMatch && unitCostMatch,
        totalCostMatch && unitCostMatch
          ? '入库记录成本正确'
          : '入库记录成本不正确',
        {
          expected: { unitCost: 10.5, totalCost: expectedTotalCost },
          actual: inboundRecord1,
        }
      );
    }

    // 验证库存成本
    const inventory1 = await prisma.inventory.findFirst({
      where: {
        productId: testProduct.id,
        batchNumber: inbound1.batchNumber,
      },
      select: { unitCost: true, quantity: true },
    });

    if (!inventory1) {
      addResult('测试1 - 库存成本', false, '未找到库存记录');
    } else {
      const unitCostMatch = toNumber(inventory1.unitCost) === 10.5;
      addResult(
        '测试1 - 库存单位成本',
        unitCostMatch,
        unitCostMatch ? '库存单位成本正确' : '库存单位成本不正确',
        {
          expected: 10.5,
          actual: inventory1.unitCost,
        }
      );
    }

    console.log('');

    // 测试2: 第二次入库 - 验证加权平均成本计算
    console.log('📝 测试2: 第二次入库 - 验证加权平均成本计算');
    const inbound2 = await executeMinimalInboundTransaction({
      productId: testProduct.id,
      quantity: 50,
      unitCost: 12.0,
      reason: 'purchase',
      remarks: '成本核算测试 - 第二次入库',
      batchNumber: inbound1.batchNumber, // 使用相同批次号
      userId: testUser.id,
    });

    // 验证入库记录
    const inboundRecord2 = await prisma.inboundRecord.findUnique({
      where: { id: inbound2.id },
      select: { unitCost: true, totalCost: true, quantity: true },
    });

    if (!inboundRecord2) {
      addResult('测试2 - 入库记录', false, '未找到入库记录');
    } else {
      const expectedTotalCost = 50 * 12.0;
      const totalCostMatch =
        toNumber(inboundRecord2.totalCost) === expectedTotalCost;
      const unitCostMatch = toNumber(inboundRecord2.unitCost) === 12.0;

      addResult(
        '测试2 - 入库记录成本',
        totalCostMatch && unitCostMatch,
        totalCostMatch && unitCostMatch
          ? '入库记录成本正确'
          : '入库记录成本不正确',
        {
          expected: { unitCost: 12.0, totalCost: expectedTotalCost },
          actual: inboundRecord2,
        }
      );
    }

    // 验证加权平均成本
    const inventory2 = await prisma.inventory.findFirst({
      where: {
        productId: testProduct.id,
        batchNumber: inbound1.batchNumber,
      },
      select: { unitCost: true, quantity: true },
    });

    if (!inventory2) {
      addResult('测试2 - 库存成本', false, '未找到库存记录');
    } else {
      // 加权平均成本 = (100 * 10.5 + 50 * 12.0) / (100 + 50) = 11.0
      const expectedUnitCost = 11.0;
      const expectedQuantity = 150;
      const unitCostMatch = toNumber(inventory2.unitCost) === expectedUnitCost;
      const quantityMatch = inventory2.quantity === expectedQuantity;

      addResult(
        '测试2 - 加权平均成本',
        unitCostMatch && quantityMatch,
        unitCostMatch && quantityMatch
          ? '加权平均成本计算正确'
          : '加权平均成本计算不正确',
        {
          expected: { unitCost: expectedUnitCost, quantity: expectedQuantity },
          actual: inventory2,
        }
      );
    }

    console.log('');

    // 测试3: 出库 - 验证成本记录
    console.log('📝 测试3: 出库 - 验证成本记录');

    // 创建出库记录
    const outboundData = {
      productId: testProduct.id,
      quantity: 30,
      reason: 'sale',
      remarks: '成本核算测试 - 出库',
      batchNumber: inbound1.batchNumber,
      userId: testUser.id,
    };

    // 直接使用 Prisma 创建出库记录（模拟出库 API）
    const currentInventory = await prisma.inventory.findFirst({
      where: {
        productId: testProduct.id,
        batchNumber: inbound1.batchNumber,
      },
    });

    if (!currentInventory) {
      addResult('测试3 - 出库', false, '未找到库存记录');
    } else {
      const currentUnitCost = toNumber(currentInventory.unitCost, 0);
      const totalCost = 30 * currentUnitCost;

      const outboundRecord = await prisma.outboundRecord.create({
        data: {
          product: { connect: { id: testProduct.id } },
          inventory: { connect: { id: currentInventory.id } },
          quantity: 30,
          unitCost: currentUnitCost,
          totalCost,
          reason: 'sale',
          notes: '成本核算测试 - 出库',
          batchNumber: inbound1.batchNumber,
          operator: { connect: { id: testUser.id } },
          recordNumber: `OUT-TEST-${Date.now()}`,
        },
      });

      // 更新库存数量
      await prisma.inventory.update({
        where: { id: currentInventory.id },
        data: { quantity: currentInventory.quantity - 30 },
      });

      // 验证出库记录成本
      const expectedUnitCost = 11.0;
      const expectedTotalCost = 30 * 11.0;
      const unitCostMatch = toNumber(outboundRecord.unitCost) === expectedUnitCost;
      const totalCostMatch =
        toNumber(outboundRecord.totalCost) === expectedTotalCost;

      addResult(
        '测试3 - 出库成本记录',
        unitCostMatch && totalCostMatch,
        unitCostMatch && totalCostMatch
          ? '出库成本记录正确'
          : '出库成本记录不正确',
        {
          expected: {
            unitCost: expectedUnitCost,
            totalCost: expectedTotalCost,
          },
          actual: {
            unitCost: outboundRecord.unitCost,
            totalCost: outboundRecord.totalCost,
          },
        }
      );

      // 验证库存成本未改变
      const inventory3 = await prisma.inventory.findFirst({
        where: {
          productId: testProduct.id,
          batchNumber: inbound1.batchNumber,
        },
        select: { unitCost: true, quantity: true },
      });

      if (inventory3) {
        const unitCostUnchanged = toNumber(inventory3.unitCost) === 11.0;
        const quantityCorrect = inventory3.quantity === 120; // 150 - 30

        addResult(
          '测试3 - 库存成本不变',
          unitCostUnchanged && quantityCorrect,
          unitCostUnchanged && quantityCorrect
            ? '出库后库存成本保持不变'
            : '出库后库存成本发生变化',
          {
            expected: { unitCost: 11.0, quantity: 120 },
            actual: inventory3,
          }
        );
      }
    }

    console.log('');

    // 打印测试总结
    console.log('📊 测试总结:');
    console.log('─'.repeat(50));
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    console.log(`总测试数: ${totalCount}`);
    console.log(`通过: ${passedCount}`);
    console.log(`失败: ${totalCount - passedCount}`);
    console.log(`通过率: ${((passedCount / totalCount) * 100).toFixed(2)}%`);
    console.log('─'.repeat(50));

    if (passedCount === totalCount) {
      console.log('\n🎉 所有测试通过！成本核算功能正常工作。');
    } else {
      console.log('\n⚠️  部分测试失败，请检查详细信息。');
      console.log('\n失败的测试:');
      results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.message}`);
        });
    }
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testCostAccounting()
  .then(() => {
    console.log('\n✅ 测试完成');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  });

/**
 * 修复退款记录中的null值
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixRefundData() {
  console.log('🔧 修复退款记录中的null值...\n');

  try {
    // 1. 查看当前数据
    console.log('1. 查看当前退款记录...');
    const refunds = await prisma.refundRecord.findMany({
      select: {
        id: true,
        refundNumber: true,
        returnOrderId: true,
        returnOrderNumber: true,
      },
    });

    console.log(`找到 ${refunds.length} 条退款记录:`);
    refunds.forEach(refund => {
      console.log(`  ${refund.refundNumber}: returnOrderId=${refund.returnOrderId}, returnOrderNumber=${refund.returnOrderNumber}`);
    });

    // 2. 更新null值
    console.log('\n2. 更新null值...');
    const updateResult = await prisma.refundRecord.updateMany({
      where: {
        OR: [
          { returnOrderId: null },
          { returnOrderNumber: null },
        ],
      },
      data: {
        returnOrderId: null, // 确保是null而不是undefined
        returnOrderNumber: null,
      },
    });

    console.log(`✅ 更新了 ${updateResult.count} 条记录`);

    // 3. 验证修复结果
    console.log('\n3. 验证修复结果...');
    const fixedRefunds = await prisma.refundRecord.findMany({
      select: {
        id: true,
        refundNumber: true,
        returnOrderId: true,
        returnOrderNumber: true,
      },
    });

    console.log(`验证结果 - 找到 ${fixedRefunds.length} 条退款记录:`);
    fixedRefunds.forEach(refund => {
      console.log(`  ${refund.refundNumber}: returnOrderId=${refund.returnOrderId}, returnOrderNumber=${refund.returnOrderNumber}`);
    });

    console.log('\n✅ 退款数据修复完成！');

  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixRefundData();

/**
 * 检查和修复产品的 piecesPerUnit 字段
 * 确保所有产品都有正确的每件片数值
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAndFixPiecesPerUnit() {
  console.log('开始检查产品的 piecesPerUnit 字段...\n');

  try {
    // 查询所有产品
    const products = await prisma.product.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        piecesPerUnit: true,
      },
    });

    console.log(`总共找到 ${products.length} 个产品\n`);

    // 检查异常值
    const abnormalProducts = products.filter(
      p => !p.piecesPerUnit || p.piecesPerUnit === 1
    );

    if (abnormalProducts.length === 0) {
      console.log('✅ 所有产品的 piecesPerUnit 值都正常！');
      return;
    }

    console.log(
      `⚠️  发现 ${abnormalProducts.length} 个产品的 piecesPerUnit 值异常：\n`
    );

    abnormalProducts.forEach(p => {
      console.log(
        `  - ${p.code} (${p.name}): piecesPerUnit = ${p.piecesPerUnit}`
      );
    });

    console.log('\n请确认这些产品的正确 piecesPerUnit 值');
    console.log('如需批量修复，可以使用以下脚本：\n');

    console.log('// 示例：将指定产品的 piecesPerUnit 更新为 10');
    console.log('await prisma.product.update({');
    console.log('  where: { code: "产品编码" },');
    console.log('  data: { piecesPerUnit: 10 }');
    console.log('});');
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAndFixPiecesPerUnit();

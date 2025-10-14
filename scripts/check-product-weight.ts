import { prisma } from '../lib/db';

async function checkProductWeight() {
  try {
    const products = await prisma.product.findMany({
      take: 5,
      select: {
        id: true,
        code: true,
        name: true,
        weight: true,
        piecesPerUnit: true,
      },
    });

    console.log('产品数据：');
    console.log(JSON.stringify(products, null, 2));

    const productsWithoutWeight = products.filter(p => !p.weight);
    console.log(
      `\n总共 ${products.length} 个产品，其中 ${productsWithoutWeight.length} 个没有设置weight值`
    );

    await prisma.$disconnect();
  } catch (error) {
    console.error('查询失败:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkProductWeight();

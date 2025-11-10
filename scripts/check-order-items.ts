import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('检查厂家发货订单明细中的每件片数字段...\n');

  // 查询最近10条订单明细
  const items = await prisma.factoryShipmentOrderItem.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      productCode: true,
      displayName: true,
      piecesPerUnit: true,
      unitCost: true,
      unit: true,
      quantity: true,
      unitPrice: true,
      createdAt: true,
    },
  });

  console.log('最近10条订单明细：');
  console.table(
    items.map(item => ({
      产品编码: item.productCode,
      产品名称: item.displayName,
      每件片数: item.piecesPerUnit ?? 'NULL',
      进货价: item.unitCost ?? 'NULL',
      单位: item.unit,
      数量: item.quantity,
      销售价: item.unitPrice,
      创建时间: item.createdAt.toLocaleString('zh-CN'),
    }))
  );

  // 统计有多少条记录的 piecesPerUnit 是 null
  const totalCount = await prisma.factoryShipmentOrderItem.count();
  const nullPiecesCount = await prisma.factoryShipmentOrderItem.count({
    where: { piecesPerUnit: null },
  });
  const nullCostCount = await prisma.factoryShipmentOrderItem.count({
    where: { unitCost: null },
  });

  console.log(`\n统计信息：`);
  console.log(`总记录数: ${totalCount}`);
  console.log(
    `piecesPerUnit 为 null 的记录数: ${nullPiecesCount} (${((nullPiecesCount / totalCount) * 100).toFixed(1)}%)`
  );
  console.log(
    `piecesPerUnit 有值的记录数: ${totalCount - nullPiecesCount} (${(((totalCount - nullPiecesCount) / totalCount) * 100).toFixed(1)}%)`
  );
  console.log(
    `unitCost 为 null 的记录数: ${nullCostCount} (${((nullCostCount / totalCount) * 100).toFixed(1)}%)`
  );
  console.log(
    `unitCost 有值的记录数: ${totalCount - nullCostCount} (${(((totalCount - nullCostCount) / totalCount) * 100).toFixed(1)}%)`
  );
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

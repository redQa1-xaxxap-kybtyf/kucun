import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.accountStatement.count();
  console.log('账单总数:', total);

  const take = 100;
  const statements = await prisma.accountStatement.findMany({
    orderBy: { id: 'asc' },
    take,
    select: {
      entityName: true,
      entityType: true,
      totalAmount: true,
      paidAmount: true,
      pendingAmount: true,
      currentBalance: true,
    },
  });

  if (total > statements.length) {
    console.log(`（仅显示前 ${statements.length} 条）`);
  }

  console.log('账单详情:');
  statements.forEach(s => {
    console.log(
      `- ${s.entityName} (${s.entityType}): 总额=${s.totalAmount}, 已付=${s.paidAmount}, 待付=${s.pendingAmount}, 余额=${s.currentBalance}`
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

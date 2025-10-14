import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const statements = await prisma.accountStatement.findMany();
  console.log('账单总数:', statements.length);
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

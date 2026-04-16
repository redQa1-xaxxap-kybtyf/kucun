import { prisma } from '@/lib/db';
import { backfillMissingPurchaseDamageLedgers } from '@/lib/services/purchase-damage-ledger-service';

async function main() {
  let total = 0;

  while (true) {
    const count = await backfillMissingPurchaseDamageLedgers(200);
    total += count;

    if (count === 0) {
      break;
    }
  }

  console.log(`采购到货破损台账回填完成，共补齐 ${total} 条记录。`);
}

main()
  .catch(error => {
    console.error('采购到货破损台账回填失败:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

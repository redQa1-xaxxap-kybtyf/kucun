/**
 * 清理往来账单中的重复交易记录
 * 运行: node scripts/clean-duplicate-transactions.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('🧹 开始清理重复的交易记录...\n');
  console.log('='.repeat(80));

  try {
    // 先检查重复记录
    const duplicates = await prisma.$queryRaw`
      SELECT
        reference_id,
        transaction_type,
        COUNT(*) as count,
        GROUP_CONCAT(id ORDER BY created_at ASC) as transaction_ids,
        GROUP_CONCAT(amount) as amounts,
        GROUP_CONCAT(DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') ORDER BY created_at ASC) as dates
      FROM statement_transactions
      GROUP BY reference_id, transaction_type
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `;

    if (duplicates.length === 0) {
      console.log('✅ 没有发现重复记录,无需清理。\n');
      return;
    }

    console.log(`⚠️  发现 ${duplicates.length} 组重复记录,准备清理...\n`);

    let totalDeleted = 0;

    for (const dup of duplicates) {
      console.log('─'.repeat(80));
      console.log(`📌 Reference ID: ${dup.reference_id}`);
      console.log(`📌 Transaction Type: ${dup.transaction_type}`);
      console.log(`📌 重复次数: ${dup.count}`);

      const ids = dup.transaction_ids.split(',');
      const amounts = dup.amounts.split(',');
      const dates = dup.dates.split(',');

      console.log(`\n保留记录 (最早创建):`);
      console.log(`  ID: ${ids[0]}`);
      console.log(`  金额: ${amounts[0]}`);
      console.log(`  创建时间: ${dates[0]}`);

      if (ids.length > 1) {
        const idsToDelete = ids.slice(1);
        console.log(`\n删除记录 (${idsToDelete.length}条):`);
        idsToDelete.forEach((id, index) => {
          console.log(
            `  ID: ${id}, 金额: ${amounts[index + 1]}, 创建时间: ${dates[index + 1]}`
          );
        });

        // 执行删除
        const result = await prisma.statementTransaction.deleteMany({
          where: {
            id: {
              in: idsToDelete,
            },
          },
        });

        console.log(`\n✅ 已删除 ${result.count} 条重复记录`);
        totalDeleted += result.count;
      }
      console.log('');
    }

    console.log('='.repeat(80));
    console.log(`\n✅ 清理完成! 共删除 ${totalDeleted} 条重复记录\n`);
    console.log('下一步操作:');
    console.log(
      '1. 运行检查脚本确认已清理: node scripts/check-duplicate-transactions.js'
    );
    console.log('2. 应用数据库约束: npx prisma db push --accept-data-loss');
    console.log('3. 重新生成Prisma Client: npx prisma generate\n');
  } catch (error) {
    console.error('❌ 清理失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicates();

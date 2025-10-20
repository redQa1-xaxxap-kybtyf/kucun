/**
 * 检查孤儿入库记录
 * 找出userId指向不存在用户的记录
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOrphanedRecords() {
  console.log('🔍 检查孤儿入库记录...\n');

  try {
    // 1. 检查入库记录
    const inboundRecords = await prisma.inboundRecord.findMany({
      select: {
        id: true,
        recordNumber: true,
        userId: true,
        createdAt: true,
      },
    });

    console.log(`📊 总入库记录数: ${inboundRecords.length}`);

    // 2. 检查每个记录的用户是否存在
    let orphanedCount = 0;
    const orphanedRecords = [];

    for (const record of inboundRecords) {
      const user = await prisma.user.findUnique({
        where: { id: record.userId },
        select: { id: true, name: true },
      });

      if (!user) {
        orphanedCount++;
        orphanedRecords.push(record);
        console.log(
          `❌ 孤儿记录: ${record.recordNumber} (userId: ${record.userId})`
        );
      }
    }

    console.log(`\n📈 统计结果:`);
    console.log(`  总记录数: ${inboundRecords.length}`);
    console.log(`  孤儿记录数: ${orphanedCount}`);
    console.log(`  正常记录数: ${inboundRecords.length - orphanedCount}`);

    if (orphanedCount > 0) {
      console.log(`\n⚠️  发现 ${orphanedCount} 条孤儿记录需要修复！`);
      console.log(`\n修复方案:`);
      console.log(`1. 方案A: 将孤儿记录的userId指向现有的管理员用户`);
      console.log(`2. 方案B: 删除这些孤儿记录`);
      console.log(`\n推荐: 方案A（保留数据）`);

      // 获取第一个管理员用户
      const adminUser = await prisma.user.findFirst({
        where: { role: 'admin' },
        select: { id: true, name: true, username: true },
      });

      if (adminUser) {
        console.log(
          `\n✅ 找到管理员用户: ${adminUser.name} (${adminUser.username})`
        );
        console.log(`   用户ID: ${adminUser.id}`);
        console.log(`\n运行以下命令修复:`);
        console.log(`   npx tsx scripts/fix-orphaned-records.ts`);
      }
    } else {
      console.log(`\n✅ 所有入库记录都有效，无需修复！`);
    }
  } catch (error) {
    console.error('❌ 检查失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkOrphanedRecords();

/**
 * 修复孤儿入库记录
 * 将userId指向现有的管理员用户
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixOrphanedRecords() {
  console.log('🔧 开始修复孤儿入库记录...\n');

  try {
    // 1. 获取管理员用户
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: { id: true, name: true, username: true },
    });

    if (!adminUser) {
      console.error('❌ 未找到管理员用户，无法修复！');
      process.exit(1);
    }

    console.log(`✅ 使用管理员用户: ${adminUser.name} (${adminUser.username})`);
    console.log(`   用户ID: ${adminUser.id}\n`);

    // 2. 扫描并修复孤儿记录（分页处理，避免全量加载）
    const batchSize = 1000;
    let cursor: string | undefined;
    let orphanedCount = 0;
    let fixedCount = 0;
    let failedCount = 0;

    while (true) {
      const records = await prisma.inboundRecord.findMany({
        select: {
          id: true,
          recordNumber: true,
          userId: true,
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (records.length === 0) {
        break;
      }

      const userIds = Array.from(new Set(records.map(r => r.userId)));
      const existingUsers =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true },
              take: userIds.length,
            })
          : [];
      const existingUserIdSet = new Set(existingUsers.map(u => u.id));

      for (const record of records) {
        if (existingUserIdSet.has(record.userId)) {
          continue;
        }

        orphanedCount++;

        try {
          await prisma.inboundRecord.update({
            where: { id: record.id },
            data: { userId: adminUser.id },
          });
          console.log(`✅ 修复记录: ${record.recordNumber}`);
          fixedCount++;
        } catch (error) {
          failedCount++;
          console.error(`❌ 修复失败 ${record.recordNumber}:`, error);
        }
      }

      cursor = records[records.length - 1].id;
    }

    console.log(`\n📊 找到 ${orphanedCount} 条孤儿记录\n`);

    if (orphanedCount === 0) {
      console.log('✅ 无需修复，所有记录都有效！');
      return;
    }

    console.log(`\n🎉 修复完成！`);
    console.log(`   成功: ${fixedCount} 条`);
    console.log(`   失败: ${failedCount} 条`);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedRecords();

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

    // 2. 找出所有孤儿记录
    const allRecords = await prisma.inboundRecord.findMany({
      select: {
        id: true,
        recordNumber: true,
        userId: true,
      },
    });

    const orphanedRecords = [];
    for (const record of allRecords) {
      const user = await prisma.user.findUnique({
        where: { id: record.userId },
      });
      if (!user) {
        orphanedRecords.push(record);
      }
    }

    console.log(`📊 找到 ${orphanedRecords.length} 条孤儿记录\n`);

    if (orphanedRecords.length === 0) {
      console.log('✅ 无需修复，所有记录都有效！');
      return;
    }

    // 3. 修复每条记录
    let fixedCount = 0;
    for (const record of orphanedRecords) {
      try {
        await prisma.inboundRecord.update({
          where: { id: record.id },
          data: { userId: adminUser.id },
        });
        console.log(`✅ 修复记录: ${record.recordNumber}`);
        fixedCount++;
      } catch (error) {
        console.error(`❌ 修复失败 ${record.recordNumber}:`, error);
      }
    }

    console.log(`\n🎉 修复完成！`);
    console.log(`   成功: ${fixedCount} 条`);
    console.log(`   失败: ${orphanedRecords.length - fixedCount} 条`);
  } catch (error) {
    console.error('❌ 修复失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedRecords();

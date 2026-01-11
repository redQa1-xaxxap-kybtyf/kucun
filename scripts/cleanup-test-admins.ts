/**
 * 清理测试管理员账户
 *
 * 功能：
 * 1. 删除所有测试管理员账户（邮箱包含 test_ 或 fifo_tester_）
 * 2. 保留真正的系统管理员（admin@example.com）
 * 3. 在事务中执行，确保原子性
 */

/* eslint-disable no-console */

import 'dotenv/config';

import { prisma } from '../lib/db';

async function main() {
  console.log('\n🧹 开始清理测试管理员账户\n');
  console.log('='.repeat(80));

  try {
    // 在事务中执行
    const result = await prisma.$transaction(async tx => {
      const testAdminWhere = {
        role: 'ADMIN',
        OR: [
          { email: { contains: 'test_' } },
          { email: { contains: 'fifo_tester_' } },
        ],
      };

      // 查找所有测试管理员
      const totalTestAdmins = await tx.user.count({
        where: testAdminWhere,
      });
      const testAdmins = await tx.user.findMany({
        where: testAdminWhere,
        select: {
          id: true,
          email: true,
          name: true,
        },
        orderBy: { id: 'asc' },
        take: 50,
      });

      console.log(`\n📍 找到 ${totalTestAdmins} 个测试管理员账户：\n`);
      testAdmins.forEach((admin, index) => {
        console.log(`   ${index + 1}. ${admin.name} (${admin.email})`);
      });

      if (totalTestAdmins > testAdmins.length) {
        console.log(
          `   ... 还有 ${totalTestAdmins - testAdmins.length} 个未显示（将仍会被清理）`
        );
      }

      if (totalTestAdmins === 0) {
        console.log('\n✅ 没有找到测试管理员账户，无需清理');
        return { deleted: 0, loginLogs: 0, systemLogs: 0 };
      }

      console.log('\n📍 删除测试管理员的关联数据...\n');

      // 删除登录日志
      const loginLogs = await tx.loginLog.deleteMany({
        where: { user: { is: testAdminWhere } },
      });
      console.log(`   ✓ 删除登录日志: ${loginLogs.count} 条`);

      // 删除系统日志
      const systemLogs = await tx.systemLog.deleteMany({
        where: { user: { is: testAdminWhere } },
      });
      console.log(`   ✓ 删除系统日志: ${systemLogs.count} 条`);

      // 删除测试管理员账户
      console.log('\n📍 删除测试管理员账户...\n');
      const deletedUsers = await tx.user.deleteMany({
        where: testAdminWhere,
      });

      console.log(`   ✓ 删除测试管理员: ${deletedUsers.count} 个`);

      return {
        deleted: deletedUsers.count,
        loginLogs: loginLogs.count,
        systemLogs: systemLogs.count,
      };
    });

    // 验证保留的管理员
    console.log('\n📍 验证保留的管理员账户：\n');
    const remainingAdminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });
    const remainingAdmins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true, username: true, name: true },
      orderBy: { id: 'asc' },
      take: 50,
    });

    console.log(
      `✅ 保留的管理员账户（展示 ${remainingAdmins.length}/${remainingAdminCount} 个）:\n`
    );
    remainingAdmins.forEach((admin, index) => {
      console.log(`   ${index + 1}. ${admin.name} (${admin.email})`);
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 清理统计：');
    console.log('='.repeat(80));
    console.log(`   删除测试管理员: ${result.deleted} 个`);
    console.log(`   删除登录日志: ${result.loginLogs} 条`);
    console.log(`   删除系统日志: ${result.systemLogs} 条`);
    console.log('='.repeat(80));
    console.log('\n✅ 测试管理员清理完成！\n');
  } catch (error) {
    console.error('\n❌ 清理失败:', error);
    console.error('\n⚠️  事务已回滚，数据库未发生任何更改');
    throw error;
  }
}

main()
  .catch(error => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

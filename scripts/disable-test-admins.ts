#!/usr/bin/env tsx

/**
 * 将测试管理员账户禁用（逻辑删除）
 *
 * 说明：
 * - 不直接 delete 用户，避免触发外键约束错误
 * - 仅对邮箱包含 test_ 或 fifo_tester_ 的管理员做处理
 * - 将这些用户的 status 改为 inactive，防止继续登录
 */

/* eslint-disable no-console */

import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🧹 开始禁用测试管理员账户（逻辑删除，而不是物理删除）\n');
  console.log('='.repeat(80));

  try {
    const testAdmins = await prisma.user.findMany({
      where: {
        role: 'admin',
        OR: [
          { email: { contains: 'test_' } },
          { email: { contains: 'fifo_tester_' } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        status: true,
      },
      take: 1000,
    });

    if (testAdmins.length === 0) {
      console.log('✅ 没有找到测试管理员账户，无需处理');
      return;
    }

    console.log(`\n📍 找到 ${testAdmins.length} 个测试管理员账户：\n`);
    testAdmins.forEach((admin, index) => {
      console.log(
        `   ${index + 1}. ${admin.name} (${admin.username} / ${admin.email}) - 当前状态: ${admin.status}`
      );
    });

    console.log('\n📍 将这些测试管理员账户的状态更新为 inactive...\n');

    const result = await prisma.user.updateMany({
      where: { id: { in: testAdmins.map(a => a.id) } },
      data: {
        status: 'inactive',
      },
    });

    console.log(`   ✓ 已更新 ${result.count} 个用户的状态为 inactive`);

    console.log('\n📍 更新完成后管理员账户情况：\n');
    const remainingAdmins = await prisma.user.findMany({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        status: true,
      },
      take: 2000,
    });

    remainingAdmins.forEach((admin, index) => {
      console.log(
        `   ${index + 1}. ${admin.name} (${admin.username} / ${admin.email}) - 状态: ${admin.status}`
      );
    });

    console.log('\n✅ 测试管理员已被禁用（无法再登录）\n');
  } catch (error) {
    console.error('\n❌ 禁用测试管理员失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

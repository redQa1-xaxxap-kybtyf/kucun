#!/usr/bin/env tsx

/**
 * 验证管理员账户脚本
 * 检查管理员账户是否存在，并验证密码是否正确
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function verifyAdmin() {
  console.log('🔍 验证管理员账户...\n');

  try {
    // 查找所有管理员用户
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin',
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        passwordHash: true,
        status: true,
        createdAt: true,
      },
    });

    if (adminUsers.length === 0) {
      console.log('❌ 没有找到管理员账户！');
      console.log('\n💡 建议：运行以下命令创建管理员账户：');
      console.log('   npx tsx scripts/create-correct-admin.ts');
      process.exit(1);
    }

    console.log(`✅ 找到 ${adminUsers.length} 个管理员账户：\n`);

    for (const admin of adminUsers) {
      console.log(`👤 ${admin.name}`);
      console.log(`   用户名: ${admin.username}`);
      console.log(`   邮箱: ${admin.email}`);
      console.log(`   状态: ${admin.status}`);
      console.log(`   创建时间: ${admin.createdAt.toLocaleString('zh-CN')}`);

      // 验证密码（假设默认密码是 admin123456）
      const isPasswordValid = await bcrypt.compare(
        'admin123456',
        admin.passwordHash
      );
      console.log(
        `   密码验证: ${isPasswordValid ? '✅ 正确 (admin123456)' : '❌ 不匹配'}`
      );
      console.log('');
    }

    // 统计其他用户
    const totalUsers = await prisma.user.count();
    const salesUsers = await prisma.user.count({
      where: { role: 'sales' },
    });

    console.log('📊 用户统计：');
    console.log(`   总用户数: ${totalUsers}`);
    console.log(`   管理员: ${adminUsers.length}`);
    console.log(`   销售员: ${salesUsers}`);
    console.log(`   其他: ${totalUsers - adminUsers.length - salesUsers}`);

    console.log('\n✨ 验证完成！');
  } catch (error) {
    console.error('\n❌ 验证失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行验证
verifyAdmin();

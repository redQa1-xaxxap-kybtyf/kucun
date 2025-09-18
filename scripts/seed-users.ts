#!/usr/bin/env tsx
/* eslint-disable no-console */

/**
 * 用户数据种子脚本
 * 创建测试用户数据
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始创建用户数据...');

  try {
    // 清理现有用户数据
    await prisma.user.deleteMany();
    console.log('✅ 清理现有用户数据完成');

    // 创建管理员用户
    const adminPassword = await bcrypt.hash('admin123456', 12);
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        name: '系统管理员',
        email: 'admin@example.com',
        passwordHash: adminPassword,
        role: 'admin',
        status: 'active',
      },
    });
    console.log('✅ 创建管理员用户:', admin.username);

    // 创建销售员用户
    const salesPassword = await bcrypt.hash('sales123456', 12);
    const sales = await prisma.user.create({
      data: {
        username: 'sales',
        name: '销售员',
        email: 'sales@example.com',
        passwordHash: salesPassword,
        role: 'sales',
        status: 'active',
      },
    });
    console.log('✅ 创建销售员用户:', sales.username);

    console.log('\n🎉 用户数据创建完成！');
    console.log('管理员账户: admin / admin123456');
    console.log('销售员账户: sales / sales123456');

  } catch (error) {
    console.error('❌ 创建用户数据失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

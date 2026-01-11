#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 检查数据库中的用户...');

    const totalUsers = await prisma.user.count();

    // 查找一部分用户（避免一次性拉取全量用户导致内存/输出失控）
    const sampleTake = 50;
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: sampleTake,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    console.log(`\n📊 找到 ${totalUsers} 个用户（显示最近 ${users.length} 个）:`);

    for (const user of users) {
      console.log(`\n👤 用户: ${user.name}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   角色: ${user.role}`);
      console.log(`   状态: ${user.status}`);
      console.log(`   创建时间: ${user.createdAt}`);
      console.log(`   密码哈希: ${user.passwordHash.substring(0, 20)}...`);
    }

    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin' },
      select: { id: true, username: true, passwordHash: true },
    });

    if (adminUser) {
      console.log('\n🔐 测试 admin 密码:');
      const testPasswords = ['admin123456', 'admin123', 'admin'];

      for (const password of testPasswords) {
        const isValid = await bcrypt.compare(password, adminUser.passwordHash);
        console.log(`   ${password}: ${isValid ? '✅ 正确' : '❌ 错误'}`);
      }
      return;
    }

    // 如果没有 admin 用户，创建一个
    if (!adminUser) {
      console.log('\n🔧 没有找到admin用户，创建一个...');

      const passwordHash = await bcrypt.hash('admin123456', 10);

      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@inventory.com',
          username: 'admin',
          name: '系统管理员',
          passwordHash,
          role: 'admin',
          status: 'active',
        },
      });

      console.log(`✅ 创建admin用户成功: ${newAdmin.name} (${newAdmin.email})`);
    }
  } catch (error) {
    console.error('❌ 检查用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();

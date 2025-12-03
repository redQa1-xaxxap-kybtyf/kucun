#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createCorrectAdmin() {
  try {
    console.log('🔧 创建/修正管理员用户...');

    // 先查是否已有用户名为 admin 的用户（避免破坏外键，改为更新而不是删除）
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    const passwordHash = await bcrypt.hash('admin123456', 10);

    let adminUser;

    if (existingAdmin) {
      console.log('🛠️ 检测到现有 admin 用户，执行修正更新...');
      adminUser = await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          email: 'admin@inventory.com',
          username: 'admin',
          name: '系统管理员',
          passwordHash,
          role: 'admin',
          status: 'active',
        },
      });
      console.log('✅ 已更新现有 admin 用户为标准配置');
    } else {
      console.log('👤 未找到 admin 用户，创建新的管理员...');
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@inventory.com',
          username: 'admin',
          name: '系统管理员',
          passwordHash,
          role: 'admin',
          status: 'active',
        },
      });
      console.log('✅ 创建新的 admin 用户成功');
    }

    console.log(`✅ 创建管理员用户成功:`);
    console.log(`   用户名: ${adminUser.username}`);
    console.log(`   邮箱: ${adminUser.email}`);
    console.log(`   姓名: ${adminUser.name}`);
    console.log(`   角色: ${adminUser.role}`);
    console.log(`   状态: ${adminUser.status}`);

    // 验证密码
    console.log('\n🔐 验证密码...');
    const isPasswordValid = await bcrypt.compare(
      'admin123456',
      adminUser.passwordHash
    );
    console.log(`   密码验证: ${isPasswordValid ? '✅ 正确' : '❌ 错误'}`);

    // 同样创建销售员用户
    console.log('\n👤 创建销售员用户...');

    const salesPasswordHash = await bcrypt.hash('sales123456', 10);

    const salesUser = await prisma.user.upsert({
      where: { username: 'sales' },
      update: {},
      create: {
        email: 'sales@inventory.com',
        username: 'sales',
        name: '销售员',
        passwordHash: salesPasswordHash,
        role: 'sales',
        status: 'active',
      },
    });

    console.log(`✅ 销售员用户: ${salesUser.name} (${salesUser.email})`);

    console.log('\n🎉 用户创建完成！');
    console.log('\n📋 登录信息:');
    console.log('管理员: admin / admin123456');
    console.log('销售员: sales / sales123456');
  } catch (error) {
    console.error('❌ 创建用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createCorrectAdmin();

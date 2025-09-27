#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createCorrectAdmin() {
  try {
    console.log('🔧 创建正确的管理员用户...');

    // 首先删除现有的错误admin用户
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (existingAdmin) {
      console.log('🗑️ 删除现有的错误admin用户...');
      await prisma.user.delete({
        where: { username: 'admin' },
      });
      console.log('✅ 删除成功');
    }

    // 创建正确的管理员用户
    console.log('👤 创建新的管理员用户...');
    
    const passwordHash = await bcrypt.hash('admin123456', 10);
    
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@inventory.com',
        username: 'admin',
        name: '系统管理员',
        passwordHash,
        role: 'admin',
        status: 'active',
      },
    });

    console.log(`✅ 创建管理员用户成功:`);
    console.log(`   用户名: ${adminUser.username}`);
    console.log(`   邮箱: ${adminUser.email}`);
    console.log(`   姓名: ${adminUser.name}`);
    console.log(`   角色: ${adminUser.role}`);
    console.log(`   状态: ${adminUser.status}`);

    // 验证密码
    console.log('\n🔐 验证密码...');
    const isPasswordValid = await bcrypt.compare('admin123456', adminUser.passwordHash);
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

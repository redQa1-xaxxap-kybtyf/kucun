#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 检查数据库中的用户...');

    // 查找所有用户
    const users = await prisma.user.findMany({
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

    console.log(`\n📊 找到 ${users.length} 个用户:`);
    
    for (const user of users) {
      console.log(`\n👤 用户: ${user.name}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   角色: ${user.role}`);
      console.log(`   状态: ${user.status}`);
      console.log(`   创建时间: ${user.createdAt}`);
      console.log(`   密码哈希: ${user.passwordHash.substring(0, 20)}...`);
      
      // 测试密码
      if (user.username === 'admin') {
        console.log('\n🔐 测试admin密码:');
        const testPasswords = ['admin123456', 'admin123', 'admin'];
        
        for (const password of testPasswords) {
          const isValid = await bcrypt.compare(password, user.passwordHash);
          console.log(`   ${password}: ${isValid ? '✅ 正确' : '❌ 错误'}`);
        }
      }
    }

    // 如果没有admin用户，创建一个
    const adminUser = users.find(u => u.username === 'admin');
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

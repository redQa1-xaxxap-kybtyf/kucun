/**
 * 创建管理员用户
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('创建管理员用户...');

    // 检查是否已存在管理员用户
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'admin' },
    });

    if (existingAdmin) {
      console.log('管理员用户已存在:', existingAdmin.username);
      return;
    }

    // 创建管理员用户
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        username: 'admin',
        name: '系统管理员',
        passwordHash: hashedPassword,
        role: 'admin',
        status: 'active',
      },
    });

    console.log('管理员用户创建成功:', admin.username);
  } catch (error) {
    console.error('创建管理员用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();

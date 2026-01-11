import bcrypt from 'bcryptjs';

import { prisma } from './db';
import { userValidations } from './validations/base';

// 简化的用户创建函数，不依赖环境变量
async function createTestUser(data: {
  email: string;
  name: string;
  password: string;
  role?: string;
}) {
  // 检查邮箱是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new Error('该邮箱已被注册');
  }

  // 加密密码
  const passwordHash = await bcrypt.hash(data.password, 10);

  // 创建用户
  const user = await prisma.user.create({
    data: {
      email: data.email,
      username: data.email.split('@')[0], // 从邮箱生成用户名
      name: data.name,
      passwordHash,
      role: data.role || 'sales',
      status: 'active',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  return user;
}

async function testAuthentication() {
  console.log('🔐 开始认证系统测试...');

  try {
    // 1. 测试用户创建功能
    console.log('\n1. 测试用户创建功能...');

    const testUserData = {
      email: 'test@inventory.com',
      name: '测试用户',
      password: 'test123456',
      role: 'sales' as const,
    };

    // 验证输入数据
    const validationResult = userValidations.register.safeParse(testUserData);
    if (!validationResult.success) {
      throw new Error('用户数据验证失败');
    }

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: testUserData.email },
    });

    let testUser;
    if (existingUser) {
      console.log('   测试用户已存在，跳过创建');
      testUser = existingUser;
    } else {
      testUser = await createTestUser(testUserData);
      console.log(
        `   ✅ 创建测试用户成功: ${testUser.name} (${testUser.email})`
      );
    }

    // 2. 测试密码验证功能
    console.log('\n2. 测试密码验证功能...');

    const user = await prisma.user.findUnique({
      where: { email: testUserData.email },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new Error('测试用户不存在');
    }

    // 测试正确密码
    const isValidPassword = await bcrypt.compare(
      testUserData.password,
      user.passwordHash
    );
    if (isValidPassword) {
      console.log('   ✅ 密码验证成功');
    } else {
      throw new Error('密码验证失败');
    }

    // 测试错误密码
    const isInvalidPassword = await bcrypt.compare(
      'wrongpassword',
      user.passwordHash
    );
    if (!isInvalidPassword) {
      console.log('   ✅ 错误密码正确被拒绝');
    } else {
      throw new Error('错误密码验证应该失败');
    }

    // 3. 测试密码更新功能
    console.log('\n3. 测试密码更新功能...');

    const newPassword = 'newtest123456';
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: testUser.id },
      data: { passwordHash: newPasswordHash },
    });

    // 验证新密码
    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { passwordHash: true },
    });

    if (!updatedUser) {
      throw new Error('更新后的用户不存在');
    }

    const isNewPasswordValid = await bcrypt.compare(
      newPassword,
      updatedUser.passwordHash
    );
    if (isNewPasswordValid) {
      console.log('   ✅ 密码更新成功');
    } else {
      throw new Error('新密码验证失败');
    }

    // 4. 测试用户状态更新功能
    console.log('\n4. 测试用户状态更新功能...');

    // 禁用用户
    await prisma.user.update({
      where: { id: testUser.id },
      data: { status: 'inactive' },
    });

    const inactiveUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { status: true },
    });

    if (inactiveUser?.status === 'inactive') {
      console.log('   ✅ 用户状态更新为非活跃成功');
    } else {
      throw new Error('用户状态更新失败');
    }

    // 重新激活用户
    await prisma.user.update({
      where: { id: testUser.id },
      data: { status: 'active' },
    });

    const activeUser = await prisma.user.findUnique({
      where: { id: testUser.id },
      select: { status: true },
    });

    if (activeUser?.status === 'active') {
      console.log('   ✅ 用户状态更新为活跃成功');
    } else {
      throw new Error('用户状态重新激活失败');
    }

    // 5. 测试用户查询功能
    console.log('\n5. 测试用户查询功能...');

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
      take: 1000,
    });

    console.log(`   ✅ 查询到 ${allUsers.length} 个用户:`);
    allUsers.forEach(user => {
      console.log(
        `      - ${user.name} (${user.email}) - ${user.role} - ${user.status}`
      );
    });

    // 6. 测试角色权限检查
    console.log('\n6. 测试角色权限检查...');

    const adminUsers = allUsers.filter(user => user.role === 'admin');
    const salesUsers = allUsers.filter(user => user.role === 'sales');

    console.log(`   ✅ 管理员用户: ${adminUsers.length} 个`);
    console.log(`   ✅ 销售员用户: ${salesUsers.length} 个`);

    // 7. 测试数据验证
    console.log('\n7. 测试数据验证...');

    // 测试登录验证
    const loginValidation = userValidations.login.safeParse({
      email: 'test@inventory.com',
      password: 'test123456',
    });

    if (loginValidation.success) {
      console.log('   ✅ 登录数据验证成功');
    } else {
      throw new Error('登录数据验证失败');
    }

    // 测试无效邮箱
    const invalidEmailValidation = userValidations.login.safeParse({
      email: 'invalid-email',
      password: 'test123456',
    });

    if (!invalidEmailValidation.success) {
      console.log('   ✅ 无效邮箱正确被拒绝');
    } else {
      throw new Error('无效邮箱验证应该失败');
    }

    // 8. 测试密码强度验证
    console.log('\n8. 测试密码强度验证...');

    const weakPasswordValidation = userValidations.register.safeParse({
      email: 'test2@inventory.com',
      name: '测试用户2',
      password: '123', // 太短的密码
      role: 'sales',
    });

    if (!weakPasswordValidation.success) {
      console.log('   ✅ 弱密码正确被拒绝');
    } else {
      throw new Error('弱密码验证应该失败');
    }

    // 清理测试数据
    console.log('\n9. 清理测试数据...');
    await prisma.user.delete({
      where: { email: testUserData.email },
    });
    console.log('   ✅ 测试用户已删除');

    console.log('\n🎉 认证系统测试完成！所有功能正常。');
  } catch (error) {
    console.error('\n❌ 认证系统测试失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此文件，执行测试
if (
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  (require as any).main === module
) {
  testAuthentication()
    .then(() => {
      console.log('\n✅ 认证测试成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 认证测试失败:', error);
      process.exit(1);
    });
}

export { testAuthentication };

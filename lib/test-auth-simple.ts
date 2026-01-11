import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testAuthenticationSimple() {
  console.log('🔐 开始认证系统简单测试...');

  try {
    // 1. 测试密码加密和验证
    console.log('\n1. 测试密码加密和验证...');

    const testPassword = 'test123456';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    console.log(`   原始密码: ${testPassword}`);
    console.log(`   加密后密码: ${hashedPassword}`);

    // 验证正确密码
    const isValidPassword = await bcrypt.compare(testPassword, hashedPassword);
    if (isValidPassword) {
      console.log('   ✅ 密码验证成功');
    } else {
      throw new Error('密码验证失败');
    }

    // 验证错误密码
    const isInvalidPassword = await bcrypt.compare(
      'wrongpassword',
      hashedPassword
    );
    if (!isInvalidPassword) {
      console.log('   ✅ 错误密码正确被拒绝');
    } else {
      throw new Error('错误密码验证应该失败');
    }

    // 2. 测试数据库连接
    console.log('\n2. 测试数据库连接...');

    const userCount = await prisma.user.count();
    console.log(`   ✅ 数据库连接成功，当前用户数量: ${userCount}`);

    // 3. 测试用户查询
    console.log('\n3. 测试用户查询...');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
      take: userCount,
    });

    console.log(`   ✅ 查询到 ${users.length} 个用户:`);
    users.forEach(user => {
      console.log(
        `      - ${user.name} (${user.email}) - ${user.role} - ${user.status}`
      );
    });

    // 4. 测试管理员用户登录验证
    console.log('\n4. 测试管理员用户登录验证...');

    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@inventory.com' },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });

    if (!adminUser) {
      throw new Error('管理员用户不存在');
    }

    // 验证管理员密码
    const adminPassword = 'admin123456';
    const isAdminPasswordValid = await bcrypt.compare(
      adminPassword,
      adminUser.passwordHash
    );

    if (isAdminPasswordValid) {
      console.log(`   ✅ 管理员登录验证成功: ${adminUser.name}`);
    } else {
      throw new Error('管理员密码验证失败');
    }

    // 检查管理员权限
    if (adminUser.role === 'admin') {
      console.log('   ✅ 管理员权限验证成功');
    } else {
      throw new Error('管理员权限验证失败');
    }

    // 检查用户状态
    if (adminUser.status === 'active') {
      console.log('   ✅ 管理员状态验证成功');
    } else {
      throw new Error('管理员状态验证失败');
    }

    // 5. 测试销售员用户登录验证
    console.log('\n5. 测试销售员用户登录验证...');

    const salesUser = await prisma.user.findUnique({
      where: { email: 'sales@inventory.com' },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        role: true,
        status: true,
      },
    });

    if (!salesUser) {
      throw new Error('销售员用户不存在');
    }

    // 验证销售员密码
    const salesPassword = 'sales123456';
    const isSalesPasswordValid = await bcrypt.compare(
      salesPassword,
      salesUser.passwordHash
    );

    if (isSalesPasswordValid) {
      console.log(`   ✅ 销售员登录验证成功: ${salesUser.name}`);
    } else {
      throw new Error('销售员密码验证失败');
    }

    // 检查销售员权限
    if (salesUser.role === 'sales') {
      console.log('   ✅ 销售员权限验证成功');
    } else {
      throw new Error('销售员权限验证失败');
    }

    // 6. 测试权限检查函数
    console.log('\n6. 测试权限检查函数...');

    const hasPermission = (
      userRole: string,
      requiredRoles: string[]
    ): boolean => requiredRoles.includes(userRole);

    const isAdmin = (userRole: string): boolean => userRole === 'admin';

    const isSales = (userRole: string): boolean => userRole === 'sales';

    // 测试管理员权限
    if (hasPermission('admin', ['admin'])) {
      console.log('   ✅ 管理员权限检查成功');
    } else {
      throw new Error('管理员权限检查失败');
    }

    if (isAdmin('admin')) {
      console.log('   ✅ 管理员身份检查成功');
    } else {
      throw new Error('管理员身份检查失败');
    }

    // 测试销售员权限
    if (hasPermission('sales', ['sales', 'admin'])) {
      console.log('   ✅ 销售员权限检查成功');
    } else {
      throw new Error('销售员权限检查失败');
    }

    if (isSales('sales')) {
      console.log('   ✅ 销售员身份检查成功');
    } else {
      throw new Error('销售员身份检查失败');
    }

    // 测试权限拒绝
    if (!hasPermission('sales', ['admin'])) {
      console.log('   ✅ 权限拒绝检查成功');
    } else {
      throw new Error('权限拒绝检查失败');
    }

    // 7. 测试密码强度
    console.log('\n7. 测试密码强度验证...');

    const validatePasswordStrength = (password: string): boolean =>
      password.length >= 6;

    if (validatePasswordStrength('admin123456')) {
      console.log('   ✅ 强密码验证成功');
    } else {
      throw new Error('强密码验证失败');
    }

    if (!validatePasswordStrength('123')) {
      console.log('   ✅ 弱密码正确被拒绝');
    } else {
      throw new Error('弱密码验证应该失败');
    }

    // 8. 测试邮箱格式验证
    console.log('\n8. 测试邮箱格式验证...');

    const validateEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    if (validateEmail('admin@inventory.com')) {
      console.log('   ✅ 有效邮箱验证成功');
    } else {
      throw new Error('有效邮箱验证失败');
    }

    if (!validateEmail('invalid-email')) {
      console.log('   ✅ 无效邮箱正确被拒绝');
    } else {
      throw new Error('无效邮箱验证应该失败');
    }

    console.log('\n🎉 认证系统简单测试完成！所有功能正常。');
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
  testAuthenticationSimple()
    .then(() => {
      console.log('\n✅ 认证测试成功完成');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 认证测试失败:', error);
      process.exit(1);
    });
}

export { testAuthenticationSimple };

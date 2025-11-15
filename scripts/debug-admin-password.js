/**
 * 调试管理员密码脚本
 * 显示密码哈希和验证详细信息
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 调试管理员密码...\n');

  try {
    // 1. 查询管理员账户
    const admin = await prisma.user.findFirst({
      where: {
        role: 'admin',
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        passwordHash: true,
      },
    });

    if (!admin) {
      console.log('❌ 未找到管理员账户！');
      return;
    }

    console.log('📊 管理员账户信息：');
    console.log(`   邮箱: ${admin.email}`);
    console.log(`   用户名: ${admin.username}`);
    console.log(`   姓名: ${admin.name}`);
    console.log(`   密码哈希: ${admin.passwordHash}`);
    console.log(`   哈希长度: ${admin.passwordHash.length}`);
    console.log('');

    // 2. 测试密码
    const testPasswords = [
      'admin123456',
      '123456',
      'admin',
      'password',
      'admin123',
    ];

    console.log('🔍 测试密码验证...\n');

    for (const password of testPasswords) {
      console.log(`测试密码: "${password}"`);

      try {
        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        console.log(`   结果: ${isMatch ? '✅ 匹配' : '❌ 不匹配'}`);
      } catch (error) {
        console.log(`   错误: ${error.message}`);
      }

      console.log('');
    }

    // 3. 生成新的密码哈希进行对比
    console.log('🔧 生成新的密码哈希...\n');

    const newHash = await bcrypt.hash('admin123456', 10);
    console.log(`新哈希: ${newHash}`);
    console.log(`新哈希长度: ${newHash.length}`);
    console.log('');

    // 4. 验证新哈希
    const newHashMatch = await bcrypt.compare('admin123456', newHash);
    console.log(`新哈希验证: ${newHashMatch ? '✅ 成功' : '❌ 失败'}`);
    console.log('');

    // 5. 检查数据库中的哈希格式
    console.log('🔍 检查密码哈希格式...\n');

    const hashPrefix = admin.passwordHash.substring(0, 7);
    console.log(`哈希前缀: ${hashPrefix}`);

    if (
      hashPrefix.startsWith('$2a$') ||
      hashPrefix.startsWith('$2b$') ||
      hashPrefix.startsWith('$2y$')
    ) {
      console.log('✅ 哈希格式正确（bcrypt）');
    } else {
      console.log('❌ 哈希格式不正确！');
      console.log('   可能不是 bcrypt 哈希');
    }

    console.log('');

    // 6. 提供解决方案
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 解决方案：');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('如果密码验证失败，运行以下命令重置密码：');
    console.log('   node scripts/reset-admin-password-auto.js');
    console.log('');
    console.log('这将把密码重置为: admin123456');
    console.log('');
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
main();

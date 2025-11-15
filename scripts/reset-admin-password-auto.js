/**
 * 自动重置管理员密码脚本
 * 将所有管理员账户的密码重置为 admin123456
 */

const fs = require('fs');
const path = require('path');

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// 默认密码
const DEFAULT_PASSWORD = 'admin123456';

async function main() {
  const output = [];

  output.push('🔐 自动重置管理员密码工具\n');

  try {
    // 1. 查询所有管理员账户
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin',
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (adminUsers.length === 0) {
      output.push('❌ 未找到管理员账户！');
      output.push('💡 建议运行: npm run db:seed');
      console.log(output.join('\n'));
      return;
    }

    output.push(`📊 找到 ${adminUsers.length} 个管理员账户：\n`);

    adminUsers.forEach((user, index) => {
      output.push(`${index + 1}. ${user.email} (用户名: ${user.username})`);
    });

    output.push('');

    // 2. 生成新密码哈希
    output.push(`🔄 正在重置密码为: ${DEFAULT_PASSWORD}\n`);

    const newPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 3. 批量更新所有管理员账户的密码
    const updatePromises = adminUsers.map(user =>
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newPasswordHash },
      })
    );

    await Promise.all(updatePromises);

    output.push(`✅ 成功重置 ${adminUsers.length} 个管理员账户的密码\n`);

    // 4. 显示登录信息
    output.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    output.push('📋 管理员账户登录信息：');
    output.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    adminUsers.forEach((user, index) => {
      output.push(`${index + 1}. 账户信息：`);
      output.push(`   邮箱: ${user.email}`);
      output.push(`   用户名: ${user.username} ⬅️ 登录时使用这个`);
      output.push(`   密码: ${DEFAULT_PASSWORD}`);
      output.push(`   姓名: ${user.name}`);
      output.push(`   状态: ${user.status}`);
      output.push('');
    });

    output.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 5. 显示重要提示
    output.push('⚠️  重要提示：');
    output.push('   1. 登录时必须使用【用户名】，不能使用邮箱');
    output.push('   2. 登录需要输入验证码');
    output.push('   3. 所有管理员账户的密码已重置为: admin123456');
    output.push('   4. 首次登录后建议修改密码\n');

    // 6. 显示登录步骤
    output.push('📝 登录步骤：');
    output.push('   1. 访问登录页面');
    output.push('   2. 输入用户名: admin');
    output.push('   3. 输入密码: admin123456');
    output.push('   4. 输入验证码');
    output.push('   5. 点击登录\n');

    output.push('✨ 密码重置完成！');

    // 输出到控制台
    console.log(output.join('\n'));

    // 保存到文件
    const outputPath = path.join(__dirname, 'admin-password-reset.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf8');
    console.log(`\n📄 结果已保存到: ${outputPath}`);
  } catch (error) {
    const errorMsg = `\n❌ 重置失败: ${error.message}`;
    output.push(errorMsg);
    console.error(errorMsg);
    console.error(error);

    // 保存错误信息
    const outputPath = path.join(__dirname, 'admin-password-error.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf8');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
main();

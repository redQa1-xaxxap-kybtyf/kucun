/**
 * 自动清理测试管理员账户脚本（无需确认）
 * 删除所有邮箱匹配 test_*@example.com 模式的测试管理员账户
 * 保留正常的管理员账户
 */

const fs = require('fs');
const path = require('path');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const output = [];

  output.push('🧹 开始清理测试管理员账户...\n');

  try {
    // 1. 查询所有管理员账户
    const allAdminUsers = await prisma.user.findMany({
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

    output.push(`📊 当前管理员账户总数: ${allAdminUsers.length}\n`);

    // 2. 筛选出测试账户（邮箱匹配 test_*@example.com）
    const testAdminUsers = allAdminUsers.filter(user =>
      /^test_\d+@example\.com$/.test(user.email)
    );

    // 3. 筛选出正常账户
    const normalAdminUsers = allAdminUsers.filter(
      user => !/^test_\d+@example\.com$/.test(user.email)
    );

    output.push(`✅ 正常管理员账户: ${normalAdminUsers.length} 个\n`);
    if (normalAdminUsers.length > 0) {
      normalAdminUsers.forEach((user, index) => {
        output.push(
          `${index + 1}. ${user.email} | ${user.name} | ${user.username}`
        );
      });
      output.push('');
    }

    output.push(`⚠️  测试管理员账户: ${testAdminUsers.length} 个\n`);
    if (testAdminUsers.length > 0) {
      // 只显示前 10 个和后 10 个
      const displayCount = Math.min(10, testAdminUsers.length);
      output.push(`前 ${displayCount} 个测试账户：`);
      testAdminUsers.slice(0, displayCount).forEach((user, index) => {
        output.push(
          `${index + 1}. ${user.email} | ${user.createdAt.toLocaleString('zh-CN')}`
        );
      });

      if (testAdminUsers.length > 20) {
        output.push(`... 省略 ${testAdminUsers.length - 20} 个 ...`);
      }

      if (testAdminUsers.length > 10) {
        output.push(`\n后 ${displayCount} 个测试账户：`);
        testAdminUsers.slice(-displayCount).forEach((user, index) => {
          output.push(
            `${testAdminUsers.length - displayCount + index + 1}. ${user.email} | ${user.createdAt.toLocaleString('zh-CN')}`
          );
        });
      }
      output.push('');
    }

    // 4. 如果没有测试账户，直接退出
    if (testAdminUsers.length === 0) {
      output.push('✨ 没有找到测试管理员账户，无需清理！');
      console.log(output.join('\n'));
      return;
    }

    // 5. 自动删除（无需确认）
    output.push('⚠️  将删除所有测试管理员账户！');
    output.push(`   将删除 ${testAdminUsers.length} 个测试账户`);
    output.push(`   保留 ${normalAdminUsers.length} 个正常账户\n`);

    // 6. 使用事务删除测试账户
    output.push('🗑️  开始删除测试账户...');

    const testUserIds = testAdminUsers.map(user => user.id);

    const result = await prisma.$transaction(async tx => {
      // 删除测试用户
      const deleteResult = await tx.user.deleteMany({
        where: {
          id: {
            in: testUserIds,
          },
        },
      });

      return deleteResult;
    });

    output.push(`✅ 成功删除 ${result.count} 个测试管理员账户\n`);

    // 7. 验证删除结果
    output.push('🔍 验证删除结果...\n');

    const remainingAdminUsers = await prisma.user.findMany({
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

    output.push(`📊 剩余管理员账户: ${remainingAdminUsers.length} 个\n`);

    if (remainingAdminUsers.length > 0) {
      remainingAdminUsers.forEach((user, index) => {
        output.push(`${index + 1}. 管理员账户信息：`);
        output.push(`   ID: ${user.id}`);
        output.push(`   邮箱: ${user.email}`);
        output.push(`   用户名: ${user.username}`);
        output.push(`   姓名: ${user.name}`);
        output.push(`   角色: ${user.role}`);
        output.push(`   状态: ${user.status}`);
        output.push(`   创建时间: ${user.createdAt.toLocaleString('zh-CN')}`);
        output.push('');
      });
    }

    // 8. 显示清理统计
    output.push('📈 清理统计：');
    output.push(`   删除前: ${allAdminUsers.length} 个管理员账户`);
    output.push(`   删除数: ${result.count} 个测试账户`);
    output.push(`   删除后: ${remainingAdminUsers.length} 个管理员账户`);
    output.push('');

    // 9. 提示如何创建标准管理员账户
    if (remainingAdminUsers.length === 0) {
      output.push('⚠️  警告：当前没有管理员账户！');
      output.push('💡 建议运行以下命令创建标准管理员账户：');
      output.push('   npm run db:seed');
      output.push('');
      output.push('   这将创建以下管理员账户：');
      output.push('   - admin@inventory.com / admin123456');
      output.push('   - admin@kucun.cn / admin123456');
    } else if (
      !remainingAdminUsers.some(
        user =>
          user.email === 'admin@inventory.com' ||
          user.email === 'admin@kucun.cn'
      )
    ) {
      output.push('💡 提示：如果需要标准管理员账户，可以运行：');
      output.push('   npm run db:seed');
      output.push('');
      output.push('   这将创建以下管理员账户：');
      output.push('   - admin@inventory.com / admin123456');
      output.push('   - admin@kucun.cn / admin123456');
    }

    output.push('\n✨ 清理完成！');

    // 输出到控制台
    console.log(output.join('\n'));

    // 保存到文件
    const outputPath = path.join(__dirname, 'clean-test-admin-result.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf8');
    console.log(`\n📄 结果已保存到: ${outputPath}`);
  } catch (error) {
    const errorMsg = `\n❌ 清理失败: ${error.message}`;
    output.push(errorMsg);
    console.error(errorMsg);
    console.error(error);

    // 保存错误信息
    const outputPath = path.join(__dirname, 'clean-test-admin-result.txt');
    fs.writeFileSync(outputPath, output.join('\n'), 'utf8');

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行清理
main();

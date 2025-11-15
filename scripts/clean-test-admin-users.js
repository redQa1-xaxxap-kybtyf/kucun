/**
 * 清理测试管理员账户脚本
 * 删除所有邮箱匹配 test_*@example.com 模式的测试管理员账户
 * 保留正常的管理员账户
 */

const readline = require('readline');

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 创建命令行交互接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 询问用户确认
function askConfirmation(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

async function main() {
  console.log('🧹 开始清理测试管理员账户...\n');

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

    console.log(`📊 当前管理员账户总数: ${allAdminUsers.length}\n`);

    // 2. 筛选出测试账户（邮箱匹配 test_*@example.com）
    const testAdminUsers = allAdminUsers.filter(user =>
      /^test_\d+@example\.com$/.test(user.email)
    );

    // 3. 筛选出正常账户
    const normalAdminUsers = allAdminUsers.filter(
      user => !/^test_\d+@example\.com$/.test(user.email)
    );

    console.log(`✅ 正常管理员账户: ${normalAdminUsers.length} 个\n`);
    if (normalAdminUsers.length > 0) {
      normalAdminUsers.forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.email} | ${user.name} | ${user.username}`
        );
      });
      console.log('');
    }

    console.log(`⚠️  测试管理员账户: ${testAdminUsers.length} 个\n`);
    if (testAdminUsers.length > 0) {
      // 只显示前 10 个和后 10 个
      const displayCount = Math.min(10, testAdminUsers.length);
      console.log(`前 ${displayCount} 个测试账户：`);
      testAdminUsers.slice(0, displayCount).forEach((user, index) => {
        console.log(
          `${index + 1}. ${user.email} | ${user.createdAt.toLocaleString('zh-CN')}`
        );
      });

      if (testAdminUsers.length > 20) {
        console.log(`... 省略 ${testAdminUsers.length - 20} 个 ...`);
      }

      if (testAdminUsers.length > 10) {
        console.log(`\n后 ${displayCount} 个测试账户：`);
        testAdminUsers.slice(-displayCount).forEach((user, index) => {
          console.log(
            `${testAdminUsers.length - displayCount + index + 1}. ${user.email} | ${user.createdAt.toLocaleString('zh-CN')}`
          );
        });
      }
      console.log('');
    }

    // 4. 如果没有测试账户，直接退出
    if (testAdminUsers.length === 0) {
      console.log('✨ 没有找到测试管理员账户，无需清理！');
      rl.close();
      return;
    }

    // 5. 询问用户确认
    console.log('⚠️  警告：此操作将删除所有测试管理员账户！');
    console.log(`   将删除 ${testAdminUsers.length} 个测试账户`);
    console.log(`   保留 ${normalAdminUsers.length} 个正常账户\n`);

    const confirmed = await askConfirmation(
      '确认删除所有测试管理员账户吗？(y/n): '
    );

    if (!confirmed) {
      console.log('\n❌ 操作已取消');
      rl.close();
      return;
    }

    // 6. 使用事务删除测试账户
    console.log('\n🗑️  开始删除测试账户...');

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

    console.log(`✅ 成功删除 ${result.count} 个测试管理员账户\n`);

    // 7. 验证删除结果
    console.log('🔍 验证删除结果...\n');

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

    console.log(`📊 剩余管理员账户: ${remainingAdminUsers.length} 个\n`);

    if (remainingAdminUsers.length > 0) {
      remainingAdminUsers.forEach((user, index) => {
        console.log(`${index + 1}. 管理员账户信息：`);
        console.log(`   ID: ${user.id}`);
        console.log(`   邮箱: ${user.email}`);
        console.log(`   用户名: ${user.username}`);
        console.log(`   姓名: ${user.name}`);
        console.log(`   角色: ${user.role}`);
        console.log(`   状态: ${user.status}`);
        console.log(`   创建时间: ${user.createdAt.toLocaleString('zh-CN')}`);
        console.log('');
      });
    }

    // 8. 显示清理统计
    console.log('📈 清理统计：');
    console.log(`   删除前: ${allAdminUsers.length} 个管理员账户`);
    console.log(`   删除数: ${result.count} 个测试账户`);
    console.log(`   删除后: ${remainingAdminUsers.length} 个管理员账户`);
    console.log('');

    // 9. 提示如何创建标准管理员账户
    if (remainingAdminUsers.length === 0) {
      console.log('⚠️  警告：当前没有管理员账户！');
      console.log('💡 建议运行以下命令创建标准管理员账户：');
      console.log('   npm run db:seed');
      console.log('');
      console.log('   这将创建以下管理员账户：');
      console.log('   - admin@inventory.com / admin123456');
      console.log('   - admin@kucun.cn / admin123456');
    } else if (
      !remainingAdminUsers.some(
        user =>
          user.email === 'admin@inventory.com' ||
          user.email === 'admin@kucun.cn'
      )
    ) {
      console.log('💡 提示：如果需要标准管理员账户，可以运行：');
      console.log('   npm run db:seed');
      console.log('');
      console.log('   这将创建以下管理员账户：');
      console.log('   - admin@inventory.com / admin123456');
      console.log('   - admin@kucun.cn / admin123456');
    }

    console.log('\n✨ 清理完成！');
  } catch (error) {
    console.error('\n❌ 清理失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

// 执行清理
main();

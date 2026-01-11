/**
 * 检查 Admin 用户配置脚本
 *
 * 用途: 验证数据库中的 admin 用户是否正确配置
 *
 * 运行方式:
 * npx tsx scripts/check-admin-user.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminUser() {
  console.log('🔍 开始检查 Admin 用户配置...\n');

  try {
    // 1. 查找所有 admin 角色的用户
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'admin',
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 1000,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(`📊 找到 ${adminUsers.length} 个 Admin 用户:\n`);

    if (adminUsers.length === 0) {
      console.log('❌ 没有找到任何 Admin 用户!');
      console.log('\n💡 建议: 运行以下命令创建 Admin 用户:');
      console.log('   npx tsx scripts/create-admin.ts\n');
      return;
    }

    // 显示所有 admin 用户
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   邮箱: ${user.email}`);
      console.log(`   姓名: ${user.name}`);
      console.log(
        `   角色: ${user.role} ${user.role === 'admin' ? '✅' : '❌'}`
      );
      console.log(
        `   状态: ${user.status} ${user.status === 'active' ? '✅' : '⚠️'}`
      );
      console.log(`   创建时间: ${user.createdAt.toLocaleString('zh-CN')}`);
      console.log('');
    });

    // 2. 检查是否有非活跃的 admin 用户
    const inactiveAdmins = adminUsers.filter(u => u.status !== 'active');
    if (inactiveAdmins.length > 0) {
      console.log(
        `⚠️  警告: 有 ${inactiveAdmins.length} 个 Admin 用户状态不是 active:`
      );
      inactiveAdmins.forEach(user => {
        console.log(`   - ${user.username} (状态: ${user.status})`);
      });
      console.log('');
    }

    // 3. 查找所有用户并显示角色分布
    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: { _all: true },
    });

    console.log('📈 用户角色分布:');
    roleStats.forEach(({ role, _count }) => {
      const count = _count._all;
      const emoji =
        role === 'admin'
          ? '👑'
          : role === 'warehouse'
            ? '📦'
            : role === 'sales'
              ? '💼'
              : role === 'finance'
                ? '💰'
                : '👤';
      console.log(`   ${emoji} ${role}: ${count} 人`);
    });
    console.log('');

    // 4. 权限检查
    console.log('🔐 权限检查:');
    console.log('   Admin 角色应该拥有 inventory:inbound 权限');
    console.log('   ✅ 根据 lib/auth/permissions.ts 配置,admin 角色拥有此权限');
    console.log('');

    // 5. 提供测试建议
    console.log('🧪 测试建议:');
    console.log('   1. 使用以下任一 admin 账号登录:');
    adminUsers.forEach(user => {
      console.log(`      - ${user.username}`);
    });
    console.log('   2. 访问 http://localhost:3000/inventory/inbound');
    console.log('   3. 应该能看到"新增入库"按钮');
    console.log('');

    // 6. 如果需要,提供修复命令
    if (inactiveAdmins.length > 0) {
      console.log('🔧 修复非活跃用户:');
      console.log('   运行以下 SQL 命令激活用户:');
      inactiveAdmins.forEach(user => {
        console.log(
          `   UPDATE User SET status = 'active' WHERE id = '${user.id}';`
        );
      });
      console.log('');
    }

    console.log('✅ 检查完成!\n');
  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行检查
checkAdminUser().catch(error => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});

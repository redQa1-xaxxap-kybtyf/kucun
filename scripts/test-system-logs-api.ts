/**
 * 测试系统日志 API 修复
 * 验证 Prisma 关系定义是否正确
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSystemLogsQuery() {
  console.log('🧪 测试系统日志 API 查询');
  console.log('='.repeat(80));

  try {
    // 测试 1: 查询日志列表（包含用户关系）
    console.log('\n📍 测试 1: 查询日志列表（包含用户关系）');
    const logs = await prisma.systemLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    });

    console.log(`   ✅ 查询成功，返回 ${logs.length} 条日志`);

    if (logs.length > 0) {
      const firstLog = logs[0];
      console.log('\n   示例日志：');
      console.log(`   - ID: ${firstLog.id}`);
      console.log(`   - 类型: ${firstLog.type}`);
      console.log(`   - 级别: ${firstLog.level}`);
      console.log(`   - 操作: ${firstLog.action}`);
      console.log(`   - 描述: ${firstLog.description}`);
      console.log(`   - 用户ID: ${firstLog.userId || '无'}`);
      console.log(
        `   - 用户信息: ${firstLog.user ? `${firstLog.user.name} (${firstLog.user.username})` : '无'}`
      );
      console.log(`   - IP地址: ${firstLog.ipAddress || '无'}`);
      console.log(`   - IP位置: ${firstLog.ipLocation || '无'}`);
      console.log(`   - 创建时间: ${firstLog.createdAt.toISOString()}`);
    }

    // 测试 2: 统计日志总数
    console.log('\n📍 测试 2: 统计日志总数');
    const total = await prisma.systemLog.count();
    console.log(`   ✅ 日志总数: ${total}`);

    // 测试 3: 按类型分组统计
    console.log('\n📍 测试 3: 按类型分组统计');
    const typeStats = await prisma.systemLog.groupBy({
      by: ['type'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    console.log('   日志类型统计：');
    typeStats.forEach(stat => {
      console.log(`   - ${stat.type}: ${stat._count.id} 条`);
    });

    // 测试 4: 按级别分组统计
    console.log('\n📍 测试 4: 按级别分组统计');
    const levelStats = await prisma.systemLog.groupBy({
      by: ['level'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    console.log('   日志级别统计：');
    levelStats.forEach(stat => {
      console.log(`   - ${stat.level}: ${stat._count.id} 条`);
    });

    // 测试 5: 查询有用户关联的日志
    console.log('\n📍 测试 5: 查询有用户关联的日志');
    const logsWithUser = await prisma.systemLog.findMany({
      where: {
        userId: {
          not: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      take: 3,
    });

    console.log(`   ✅ 找到 ${logsWithUser.length} 条有用户关联的日志`);
    logsWithUser.forEach((log, index) => {
      console.log(
        `   ${index + 1}. ${log.action} - ${log.user?.name} (${log.user?.username})`
      );
    });

    // 测试 6: 查询无用户关联的日志（系统日志）
    console.log('\n📍 测试 6: 查询无用户关联的日志（系统日志）');
    const systemLogs = await prisma.systemLog.findMany({
      where: {
        userId: null,
      },
      take: 3,
    });

    console.log(`   ✅ 找到 ${systemLogs.length} 条系统日志（无用户关联）`);
    systemLogs.forEach((log, index) => {
      console.log(`   ${index + 1}. ${log.action} - ${log.description}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ 所有测试通过！系统日志 API 修复成功！');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error('   错误信息:', error.message);
      console.error('   错误堆栈:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testSystemLogsQuery();

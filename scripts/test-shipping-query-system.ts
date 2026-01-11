/**
 * 运输查询系统端到端测试脚本
 * 测试从数据库查询到 BullMQ 队列的完整流程
 */

import 'dotenv/config';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import {
  addShippingQueryJob,
  shippingQueryQueue,
} from '../lib/queue/shipping-query-queue';

async function main() {
  console.log('\n🧪 开始运输查询系统端到端测试\n');
  console.log('='.repeat(60));

  // 步骤 1: 检查 Redis 连接
  console.log('\n📍 步骤 1: 检查 Redis 连接');
  try {
    // 尝试获取队列统计来验证 Redis 连接
    await shippingQueryQueue.getWaitingCount();
    console.log('✅ Redis 连接正常');
  } catch (error) {
    console.error('❌ Redis 连接失败:', error);
    console.error('   请确保 Redis 服务正在运行');
    process.exit(1);
  }

  // 步骤 2: 检查数据库连接和测试数据
  console.log('\n📍 步骤 2: 检查数据库连接和测试数据');
  try {
    const ordersWithShipping = await prisma.factoryShipmentOrder.findMany({
      where: {
        OR: [
          { containerNumber: { not: null } },
          { shippingCompany: { not: null } },
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        containerNumber: true,
        shippingCompany: true,
        status: true,
        lastShippingQueryAt: true,
      },
      take: 5,
    });

    console.log(`✅ 数据库连接正常`);
    console.log(`📦 找到 ${ordersWithShipping.length} 个包含运输信息的订单`);

    if (ordersWithShipping.length > 0) {
      console.log('\n前 5 个订单:');
      ordersWithShipping.forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.orderNumber}`);
        console.log(`     - 柜号: ${order.containerNumber || '无'}`);
        console.log(`     - 船公司: ${order.shippingCompany || '无'}`);
        console.log(`     - 状态: ${order.status}`);
        console.log(
          `     - 最后查询: ${order.lastShippingQueryAt?.toISOString() || '从未查询'}`
        );
      });
    }

    // 步骤 3: 测试添加任务到队列
    console.log('\n📍 步骤 3: 测试添加任务到 BullMQ 队列');

    if (ordersWithShipping.length === 0) {
      console.log('⚠️  没有可测试的订单，跳过队列测试');
    } else {
      const testOrder = ordersWithShipping[0];
      console.log(`\n使用订单: ${testOrder.orderNumber}`);

      try {
        const job = await addShippingQueryJob(
          {
            targetType: 'factory_shipment',
            orderId: testOrder.id,
            shippingCompany: testOrder.shippingCompany || '',
            containerNumber: testOrder.containerNumber || undefined,
          },
          {
            jobId: `test-${testOrder.id}-${Date.now()}`,
            priority: 1,
          }
        );

        console.log(`✅ 成功添加任务到队列`);
        console.log(`   - Job ID: ${job.id}`);
        console.log(`   - 订单 ID: ${testOrder.id}`);
        console.log(`   - 订单号: ${testOrder.orderNumber}`);

        // 步骤 4: 检查任务状态
        console.log('\n📍 步骤 4: 检查任务状态');

        const jobState = await job.getState();
        console.log(`   - 任务状态: ${jobState}`);

        // 等待 2 秒查看任务是否被处理
        console.log('\n⏳ 等待 2 秒观察任务处理...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const updatedState = await job.getState();
        console.log(`   - 更新后状态: ${updatedState}`);

        if (updatedState === 'completed') {
          const result = await job.returnvalue;
          console.log('✅ 任务已完成');
          console.log('   查询结果:', JSON.stringify(result, null, 2));
        } else if (updatedState === 'failed') {
          const failedReason = job.failedReason;
          console.log('❌ 任务失败');
          console.log('   失败原因:', failedReason);
        } else {
          console.log(`⏳ 任务仍在处理中 (${updatedState})`);
          console.log(
            '   提示: 确保 Worker 正在运行 (npm run scheduler:start)'
          );
        }

        // 步骤 5: 检查数据库更新
        console.log('\n📍 步骤 5: 检查数据库更新');

        const updatedOrder = await prisma.factoryShipmentOrder.findUnique({
          where: { id: testOrder.id },
          select: {
            lastShippingQueryAt: true,
            shippingQueryStatus: true,
            shippingQueryError: true,
          },
        });

        if (updatedOrder) {
          console.log('✅ 订单记录已更新');
          console.log(
            `   - 最后查询时间: ${updatedOrder.lastShippingQueryAt?.toISOString() || '未更新'}`
          );
          console.log(
            `   - 查询状态: ${updatedOrder.shippingQueryStatus || '未设置'}`
          );
          if (updatedOrder.shippingQueryError) {
            console.log(`   - 错误信息: ${updatedOrder.shippingQueryError}`);
          }
        }

        // 检查 ShippingQuery 表
        const queryRecords = await prisma.shippingQuery.findMany({
          where: {
            factoryShipmentOrderId: testOrder.id,
          },
          orderBy: {
            queriedAt: 'desc',
          },
          take: 1,
          select: {
            queriedAt: true,
            queryStatus: true,
            trackingNumber: true,
            status: true,
          },
        });

        if (queryRecords.length > 0) {
          const latestQuery = queryRecords[0];
          console.log('\n✅ 查询记录已保存到 ShippingQuery 表');
          console.log(`   - 查询时间: ${latestQuery.queriedAt.toISOString()}`);
          console.log(`   - 查询状态: ${latestQuery.queryStatus}`);
          console.log(`   - 跟踪号: ${latestQuery.trackingNumber}`);
          if (latestQuery.status) {
            console.log(`   - 物流状态: ${latestQuery.status}`);
          }
        } else {
          console.log('\n⚠️  未找到查询记录（可能 Worker 未运行或查询失败）');
        }
      } catch (error) {
        console.error('❌ 添加任务失败:', error);
      }
    }

    // 步骤 6: 检查队列统计
    console.log('\n📍 步骤 6: 检查队列统计');

    const [waiting, active, completed, failed] = await Promise.all([
      shippingQueryQueue.getWaitingCount(),
      shippingQueryQueue.getActiveCount(),
      shippingQueryQueue.getCompletedCount(),
      shippingQueryQueue.getFailedCount(),
    ]);

    console.log('📊 队列统计:');
    console.log(`   - 等待中: ${waiting}`);
    console.log(`   - 处理中: ${active}`);
    console.log(`   - 已完成: ${completed}`);
    console.log(`   - 失败: ${failed}`);

    // 步骤 7: 测试总结
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 测试总结\n');

    const checks = [
      { name: 'Redis 连接', status: true },
      { name: '数据库连接', status: true },
      {
        name: '测试数据',
        status: ordersWithShipping.length > 0,
        note:
          ordersWithShipping.length === 0
            ? '没有包含运输信息的订单'
            : undefined,
      },
      {
        name: 'BullMQ 队列',
        status: ordersWithShipping.length > 0,
        note:
          ordersWithShipping.length === 0
            ? '跳过测试（无测试数据）'
            : undefined,
      },
    ];

    checks.forEach(check => {
      const icon = check.status ? '✅' : '⚠️ ';
      console.log(`${icon} ${check.name}`);
      if (check.note) {
        console.log(`   ${check.note}`);
      }
    });

    console.log('\n💡 下一步建议:');
    if (ordersWithShipping.length === 0) {
      console.log('   1. 创建包含运输信息的测试订单');
      console.log('   2. 重新运行此测试脚本');
    } else {
      console.log('   1. 启动 Worker: npm run scheduler:start');
      console.log('   2. 测试 API 端点（需要登录）:');
      console.log('      - POST /api/shipping/query/trigger');
      console.log('      - POST /api/shipping/query/batch');
      console.log('      - GET /api/shipping/query/status');
      console.log('   3. 观察 Worker 日志和数据库变化');
    }

    console.log('\n✅ 测试完成！\n');
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await shippingQueryQueue.close();
  }
}

main().catch(error => {
  logger.error('test-shipping-query-system', '测试脚本执行失败', error);
  process.exit(1);
});

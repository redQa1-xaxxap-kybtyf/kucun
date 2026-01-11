import { type NextRequest, NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * ⚠️ 临时演示用「一键清空业务数据」API
 *
 * - 仅用于当前还未正式投产的环境，清空所有业务数据，但保留管理员账号
 * - 需要满足所有条件才会执行：
 *   1）请求方式为 POST
 *   2）当前用户为 admin（通过 withAuth(requireAdmin: true) 控制）
 *   3）环境变量 ENABLE_DEMO_CLEAR_API = 'true'
 *   4）请求体中 confirmCode === 'DELETE_ALL_DATA'
 *
 * 使用建议：
 * - 仅在「还未正式使用、只有测试数据」的环境短期开启
 * - 清空后尽快在环境变量中关闭 ENABLE_DEMO_CLEAR_API
 * - 正式生产环境请使用数据库备份 / 恢复或迁移方案，不要长期依赖此接口
 */

async function clearDemoDataInDatabase() {
  logger.warn(
    'admin',
    '执行演示环境一键清空业务数据（保留管理员账户），请确认当前环境仅用于测试 / 演示'
  );

  // 这段逻辑与 scripts/clear-database.ts 保持语义一致：
  // 清空所有业务数据，但保留管理员账户

  // 1. 运输查询
  await prisma.shippingQuery.deleteMany();

  // 2. 登录记录与账户锁定
  await prisma.loginAttempt.deleteMany();
  await prisma.accountLockout.deleteMany();

  // 3. 付款相关
  await prisma.paymentOutRecord.deleteMany();
  await prisma.payableRecord.deleteMany();

  // 4. 系统日志与设置
  await prisma.systemLog.deleteMany();
  await prisma.settingChangeLog.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 5. 订单序列
  await prisma.orderSequence.deleteMany();

  // 6. 往来账单与交易
  await prisma.statementTransaction.deleteMany();
  await prisma.accountStatement.deleteMany();

  // 7. 退款与退货
  await prisma.refundRecord.deleteMany();
  await prisma.returnOrderItem.deleteMany();
  await prisma.returnOrder.deleteMany();

  // 8. 厂家发货订单
  await prisma.factoryShipmentOrderItem.deleteMany();
  await prisma.factoryShipmentOrder.deleteMany();

  // 9. 收款记录（应收、实收）
  await prisma.paymentRecord.deleteMany();

  // 10. 库存调整与操作
  await prisma.inventoryAdjustment.deleteMany();
  await prisma.inventoryOperation.deleteMany();

  // 11. 出入库记录
  await prisma.outboundRecord.deleteMany();
  await prisma.inboundRecord.deleteMany();

  // 12. 批次规格
  await prisma.batchSpecification.deleteMany();

  // 13. 库存记录
  await prisma.inventory.deleteMany();

  // 14. 价格历史
  await prisma.customerProductPrice.deleteMany();
  await prisma.supplierProductPrice.deleteMany();

  // 15. 销售订单
  await prisma.salesOrderFeeItem.deleteMany();
  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();

  // 16. 产品及变体
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();

  // 17. 分类
  await prisma.category.deleteMany();

  // 18. 供应商
  await prisma.supplier.deleteMany();

  // 19. 客户
  await prisma.customer.deleteMany();

  // 20. 收藏 / 浏览历史
  await prisma.productFavorite.deleteMany();
  await prisma.productViewHistory.deleteMany();

  // 21. 非管理员用户
  const deletedUsers = await prisma.user.deleteMany({
    where: {
      role: {
        not: 'admin',
      },
    },
  });

  // 22. 检查剩余管理员账户
  const adminUsers = await prisma.user.findMany({
    where: { role: 'admin' },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
    },
    take: 1000,
  });

  return {
    adminCount: adminUsers.length,
    deletedNonAdminUsers: deletedUsers.count,
    admins: adminUsers,
  };
}

export const POST = withAuth(
  async (request: NextRequest) => {
    // 1. 环境变量开关
    const enabled =
      process.env.ENABLE_DEMO_CLEAR_API === 'true' ||
      process.env.ENABLE_DEMO_CLEAR_API === '1';

    if (!enabled) {
      return NextResponse.json(
        {
          success: false,
          error:
            '演示清空接口未启用。请在环境变量中设置 ENABLE_DEMO_CLEAR_API=true 后再尝试。',
        },
        { status: 403 }
      );
    }

    // 2. 确认码校验，避免误触
    let body: { confirmCode?: string } = {};
    try {
      body = (await request.json()) as { confirmCode?: string };
    } catch {
      // ignore, 交给后面的校验
    }

    if (body.confirmCode !== 'DELETE_ALL_DATA') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少确认码或确认码不正确，请传入 confirmCode=DELETE_ALL_DATA',
        },
        { status: 400 }
      );
    }

    try {
      const result = await clearDemoDataInDatabase();

      return NextResponse.json({
        success: true,
        message: '已清空所有业务数据（保留管理员账户）',
        ...result,
      });
    } catch (error) {
      logger.error('admin', '执行演示清空接口失败', error);
      return NextResponse.json(
        {
          success: false,
          error: '清空数据失败，请查看服务器日志',
        },
        { status: 500 }
      );
    }
  },
  {
    // 仅管理员可调用
    requireAdmin: true,
  }
);

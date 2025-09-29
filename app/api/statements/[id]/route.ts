import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/statements/[id] - 获取往来账单详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { id } = params;

    // 首先尝试作为客户查找
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        salesOrders: {
          where: {
            // 问题2修复：只处理有效的订单状态，过滤掉draft、cancelled等无效单据
            status: {
              in: ['confirmed', 'shipped', 'completed'],
            },
          },
          include: {
            payments: {
              where: {
                status: 'confirmed',
              },
              orderBy: {
                paymentDate: 'desc',
              },
            },
            refunds: {
              where: {
                status: 'completed',
              },
              orderBy: {
                refundDate: 'desc',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (customer) {
      // 计算客户统计数据
      const totalOrders = customer.salesOrders.length;
      const totalAmount = customer.salesOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      );

      const paidAmount = customer.salesOrders.reduce((sum, order) => {
        const orderPaidAmount = order.payments.reduce(
          (paySum, payment) => paySum + payment.paymentAmount,
          0
        );
        return sum + orderPaidAmount;
      }, 0);

      const refundAmount = customer.salesOrders.reduce((sum, order) => {
        const orderRefundAmount = order.refunds.reduce(
          (refundSum, refund) => refundSum + refund.refundAmount,
          0
        );
        return sum + orderRefundAmount;
      }, 0);

      // 问题1修复：退款应该减少应收款，修正计算公式
      // 正确公式：待收金额 = 总金额 - 已付金额 - 退款金额
      const pendingAmount = Math.max(
        0,
        totalAmount - paidAmount - refundAmount
      );

      // 计算逾期金额
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const overdueOrders = customer.salesOrders.filter(
        order =>
          order.createdAt < thirtyDaysAgo &&
          ['confirmed', 'shipped'].includes(order.status)
      );

      const overdueAmount = overdueOrders.reduce((sum, order) => {
        const orderPaidAmount = order.payments.reduce(
          (paySum, payment) => paySum + payment.paymentAmount,
          0
        );
        const unpaidAmount = Math.max(0, order.totalAmount - orderPaidAmount);
        return sum + unpaidAmount;
      }, 0);

      // 构建交易记录
      const transactions: Array<{
        id: string;
        type: string;
        referenceNumber: string;
        amount: number;
        description: string;
        transactionDate: string;
        dueDate?: string;
        status: string;
        balance?: number;
      }> = [];

      // 添加销售订单记录
      for (const order of customer.salesOrders) {
        transactions.push({
          id: `order-${order.id}`,
          type: 'sale',
          referenceNumber: order.orderNumber,
          amount: order.totalAmount,
          description: `销售订单 - ${order.remarks || '商品销售'}`,
          transactionDate: order.createdAt.toISOString().split('T')[0],
          dueDate: new Date(
            order.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
          )
            .toISOString()
            .split('T')[0],
          status: order.status === 'completed' ? 'completed' : 'pending',
        });

        // 添加付款记录
        for (const payment of order.payments) {
          transactions.push({
            id: `payment-${payment.id}`,
            type: 'payment',
            referenceNumber: payment.paymentNumber,
            amount: -payment.paymentAmount,
            description: `客户付款 - ${payment.paymentMethod}`,
            transactionDate: payment.paymentDate.toISOString().split('T')[0],
            status: payment.status === 'confirmed' ? 'completed' : 'pending',
          });
        }

        // 问题1修复：退款记录应该保存为负值，表示减少应收款
        for (const refund of order.refunds) {
          transactions.push({
            id: `refund-${refund.id}`,
            type: 'refund',
            referenceNumber: refund.refundNumber,
            amount: -refund.refundAmount, // 退款金额保存为负值
            description: `退款 - ${refund.reason}`,
            transactionDate: refund.refundDate.toISOString().split('T')[0],
            status: refund.status === 'completed' ? 'completed' : 'pending',
          });
        }
      }

      // 按日期排序交易记录
      transactions.sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime()
      );

      // 计算余额
      let runningBalance = 0;
      for (let i = transactions.length - 1; i >= 0; i--) {
        runningBalance += transactions[i].amount;
        transactions[i].balance = runningBalance;
      }

      // 获取最后交易和付款日期
      const lastTransactionDate = customer.salesOrders[0]?.createdAt
        .toISOString()
        .split('T')[0];

      const lastPayment = customer.salesOrders
        .flatMap(order => order.payments)
        .sort(
          (a, b) =>
            new Date(b.paymentDate).getTime() -
            new Date(a.paymentDate).getTime()
        )[0];

      const lastPaymentDate = lastPayment?.paymentDate
        .toISOString()
        .split('T')[0];

      // 计算月度统计
      const currentMonth = new Date();
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const currentMonthOrders = customer.salesOrders.filter(
        order =>
          order.createdAt.getMonth() === currentMonth.getMonth() &&
          order.createdAt.getFullYear() === currentMonth.getFullYear()
      );

      const lastMonthOrders = customer.salesOrders.filter(
        order =>
          order.createdAt.getMonth() === lastMonth.getMonth() &&
          order.createdAt.getFullYear() === lastMonth.getFullYear()
      );

      const currentMonthAmount = currentMonthOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      );

      const lastMonthAmount = lastMonthOrders.reduce(
        (sum, order) => sum + order.totalAmount,
        0
      );

      const averageMonthlyAmount = totalAmount / Math.max(1, totalOrders);
      const paymentRate =
        totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

      const statementDetail = {
        id: customer.id,
        name: customer.name,
        type: 'customer',
        totalOrders,
        totalAmount,
        paidAmount,
        pendingAmount,
        overdueAmount,
        creditLimit: 50000, // 默认值，实际应从客户扩展信息获取
        paymentTerms: '30天',
        status: overdueAmount > 0 ? 'overdue' : 'active',
        lastTransactionDate,
        lastPaymentDate,
        contact: {
          phone: customer.phone || '',
          address: customer.address || '',
        },
        transactions: transactions.slice(0, 50), // 限制返回最近50条记录
        summary: {
          currentMonthAmount,
          lastMonthAmount,
          averageMonthlyAmount,
          paymentRate: Math.round(paymentRate * 100) / 100,
          averagePaymentDays: 25, // 简化计算
        },
      };

      return NextResponse.json({
        success: true,
        data: statementDetail,
      });
    }

    // 如果不是客户，尝试作为供应商查找
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        salesOrders: {
          where: {
            orderType: 'TRANSFER',
            // 问题2修复：只处理有效的订单状态
            status: {
              in: ['confirmed', 'shipped', 'completed'],
            },
          },
          include: {
            // 问题3修复：包含付款记录以计算已付金额
            payments: {
              where: {
                status: 'confirmed',
              },
              orderBy: {
                paymentDate: 'desc',
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        factoryShipmentOrderItems: {
          include: {
            factoryShipmentOrder: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (supplier) {
      // 问题3修复：完善供应商统计计算
      const totalOrders = supplier.salesOrders.length;
      const transferAmount = supplier.salesOrders.reduce(
        (sum, order) => sum + (order.costAmount || 0),
        0
      );

      const factoryOrderAmount = supplier.factoryShipmentOrderItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0
      );

      // 问题3修复：计算已付金额
      const transferPaidAmount = supplier.salesOrders.reduce((sum, order) => {
        const orderPaidAmount = order.payments.reduce(
          (paySum, payment) => paySum + payment.paymentAmount,
          0
        );
        return sum + orderPaidAmount;
      }, 0);

      // 问题3修复：厂家发货订单的付款金额从订单本身的paidAmount字段获取
      const factoryPaidAmount = supplier.factoryShipmentOrderItems.reduce(
        (sum, item) => sum + (item.factoryShipmentOrder.paidAmount || 0),
        0
      );

      const totalAmount = transferAmount + factoryOrderAmount;
      const paidAmount = transferPaidAmount + factoryPaidAmount;
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      // 问题3修复：生成交易明细
      const transactions: Array<{
        id: string;
        type: string;
        referenceNumber: string;
        amount: number;
        description: string;
        transactionDate: string;
        status: string;
      }> = [];

      // 添加调货销售订单记录
      for (const order of supplier.salesOrders) {
        transactions.push({
          id: `transfer-${order.id}`,
          type: 'purchase',
          referenceNumber: order.orderNumber,
          amount: order.costAmount || 0,
          description: `调货采购 - ${order.orderNumber}`,
          transactionDate: order.createdAt.toISOString().split('T')[0],
          status: order.status === 'completed' ? 'completed' : 'pending',
        });

        // 添加付款记录
        for (const payment of order.payments) {
          transactions.push({
            id: `payment-${payment.id}`,
            type: 'payment_out',
            referenceNumber: payment.paymentNumber,
            amount: -payment.paymentAmount,
            description: `供应商付款 - ${payment.paymentMethod}`,
            transactionDate: payment.paymentDate.toISOString().split('T')[0],
            status: payment.status === 'confirmed' ? 'completed' : 'pending',
          });
        }
      }

      // 添加厂家发货订单记录
      for (const item of supplier.factoryShipmentOrderItems) {
        transactions.push({
          id: `factory-${item.id}`,
          type: 'purchase',
          referenceNumber: item.factoryShipmentOrder.orderNumber,
          amount: item.totalPrice,
          description: `厂家发货 - ${item.displayName}`,
          transactionDate: item.createdAt.toISOString().split('T')[0],
          status:
            item.factoryShipmentOrder.status === 'completed'
              ? 'completed'
              : 'pending',
        });

        // 问题3修复：如果厂家发货订单有已付金额，添加付款记录
        if (item.factoryShipmentOrder.paidAmount > 0) {
          transactions.push({
            id: `factory-payment-${item.factoryShipmentOrder.id}`,
            type: 'payment_out',
            referenceNumber: `PAY-${item.factoryShipmentOrder.orderNumber}`,
            amount: -item.factoryShipmentOrder.paidAmount,
            description: `厂家发货付款 - ${item.factoryShipmentOrder.orderNumber}`,
            transactionDate: item.factoryShipmentOrder.updatedAt
              .toISOString()
              .split('T')[0],
            status: 'completed',
          });
        }
      }

      // 按日期排序交易记录
      transactions.sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime()
      );

      const supplierDetail = {
        id: supplier.id,
        name: supplier.name,
        type: 'supplier',
        totalOrders,
        totalAmount,
        paidAmount,
        pendingAmount,
        overdueAmount: 0, // 简化实现
        creditLimit: 100000,
        paymentTerms: '30天',
        status: 'active',
        lastTransactionDate: supplier.salesOrders[0]?.createdAt
          .toISOString()
          .split('T')[0],
        lastPaymentDate:
          paidAmount > 0
            ? transactions.find((t: any) => t.type === 'payment_out')
                ?.transactionDate
            : null,
        contact: {
          phone: supplier.phone || '',
          address: supplier.address || '',
        },
        transactions: transactions.slice(0, 50), // 限制返回最近50条记录
        summary: {
          currentMonthAmount: 0, // 简化实现
          lastMonthAmount: 0,
          averageMonthlyAmount: totalAmount / Math.max(1, totalOrders),
          paymentRate: totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0,
          averagePaymentDays: 30,
        },
      };

      return NextResponse.json({
        success: true,
        data: supplierDetail,
      });
    }

    // 如果既不是客户也不是供应商
    return NextResponse.json(
      { success: false, error: '账单不存在' },
      { status: 404 }
    );
  } catch (error) {
    console.error('获取账单详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取账单详情失败' },
      { status: 500 }
    );
  }
}

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { createRefundRecordSchema } from '@/lib/validations/refund';

/**
 * 应退货款API
 * GET /api/finance/refunds - 获取退款记录列表
 * POST /api/finance/refunds - 创建退款记录
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const refundType = searchParams.get('refundType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 由于当前数据库中没有退款记录表，这里返回模拟数据
    // 实际项目中应该创建 refund_records 表并查询真实数据

    const mockRefunds = [
      {
        id: '1',
        refundNumber: 'RT-2025-001',
        returnOrderId: 'RET-2025-001',
        returnOrderNumber: 'RET-2025-001',
        salesOrderId: 'SO-2025-001',
        salesOrderNumber: 'SO-2025-001',
        customerId: '1',
        customerName: '张三建材',
        refundType: 'full_refund',
        refundMethod: 'bank_transfer',
        refundAmount: 5000.0,
        processedAmount: 0.0,
        remainingAmount: 5000.0,
        status: 'pending',
        refundDate: '2025-01-15',
        processedDate: null,
        reason: '产品质量问题',
        remarks: '',
        bankInfo: '中国银行 6222 **** **** 1234',
        receiptNumber: '',
        createdAt: '2025-01-15T10:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
      },
      {
        id: '2',
        refundNumber: 'RT-2025-002',
        returnOrderId: 'RET-2025-002',
        returnOrderNumber: 'RET-2025-002',
        salesOrderId: 'SO-2025-002',
        salesOrderNumber: 'SO-2025-002',
        customerId: '2',
        customerName: '李四装饰',
        refundType: 'partial_refund',
        refundMethod: 'original_payment',
        refundAmount: 3000.0,
        processedAmount: 3000.0,
        remainingAmount: 0.0,
        status: 'completed',
        refundDate: '2025-01-12',
        processedDate: '2025-01-14',
        reason: '部分商品不符合要求',
        remarks: '已完成退款',
        bankInfo: '',
        receiptNumber: 'RC-2025-001',
        createdAt: '2025-01-12T14:30:00Z',
        updatedAt: '2025-01-14T16:20:00Z',
      },
      {
        id: '3',
        refundNumber: 'RT-2025-003',
        returnOrderId: 'RET-2025-003',
        returnOrderNumber: 'RET-2025-003',
        salesOrderId: 'SO-2025-003',
        salesOrderNumber: 'SO-2025-003',
        customerId: '3',
        customerName: '王五建设',
        refundType: 'exchange_refund',
        refundMethod: 'cash',
        refundAmount: 1500.0,
        processedAmount: 0.0,
        remainingAmount: 1500.0,
        status: 'processing',
        refundDate: '2025-01-10',
        processedDate: null,
        reason: '换货差价退款',
        remarks: '正在处理中',
        bankInfo: '',
        receiptNumber: '',
        createdAt: '2025-01-10T09:15:00Z',
        updatedAt: '2025-01-16T11:30:00Z',
      },
    ];

    // 应用筛选条件
    let filteredRefunds = mockRefunds;

    if (search) {
      filteredRefunds = filteredRefunds.filter(
        refund =>
          refund.refundNumber.includes(search) ||
          refund.customerName.includes(search) ||
          refund.returnOrderNumber.includes(search) ||
          refund.salesOrderNumber.includes(search)
      );
    }

    if (status) {
      filteredRefunds = filteredRefunds.filter(
        refund => refund.status === status
      );
    }

    if (customerId) {
      filteredRefunds = filteredRefunds.filter(
        refund => refund.customerId === customerId
      );
    }

    if (refundType) {
      filteredRefunds = filteredRefunds.filter(
        refund => refund.refundType === refundType
      );
    }

    if (startDate && endDate) {
      filteredRefunds = filteredRefunds.filter(refund => {
        const refundDate = new Date(refund.refundDate);
        return (
          refundDate >= new Date(startDate) && refundDate <= new Date(endDate)
        );
      });
    }

    // 排序
    filteredRefunds.sort((a, b) => {
      const aValue = a[sortBy as keyof typeof a];
      const bValue = b[sortBy as keyof typeof b];

      if (sortOrder === 'desc') {
        return aValue > bValue ? -1 : 1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // 分页
    const total = filteredRefunds.length;
    const skip = (page - 1) * pageSize;
    const paginatedRefunds = filteredRefunds.slice(skip, skip + pageSize);

    // 计算统计数据
    const summary = {
      totalRefunds: filteredRefunds.reduce((sum, r) => sum + r.refundAmount, 0),
      totalProcessed: filteredRefunds.reduce(
        (sum, r) => sum + r.processedAmount,
        0
      ),
      totalPending: filteredRefunds.reduce(
        (sum, r) => sum + r.remainingAmount,
        0
      ),
      refundCount: filteredRefunds.length,
      pendingCount: filteredRefunds.filter(r => r.status === 'pending').length,
      processingCount: filteredRefunds.filter(r => r.status === 'processing')
        .length,
      completedCount: filteredRefunds.filter(r => r.status === 'completed')
        .length,
    };

    return NextResponse.json({
      success: true,
      data: {
        refunds: paginatedRefunds,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        summary,
      },
    });
  } catch (error) {
    console.error('获取退款记录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取退款记录失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 创建退款记录
 */
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validatedData = createRefundRecordSchema.parse(body);

    // 生成退款单号
    const refundNumber = `RT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // 创建退款记录（这里应该插入到实际的退款记录表）
    const newRefund = {
      id: String(Date.now()),
      refundNumber,
      ...validatedData,
      processedAmount: 0,
      remainingAmount: validatedData.refundAmount,
      status: 'pending',
      processedDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 实际项目中应该：
    // 1. 验证退货订单和销售订单是否存在
    // 2. 检查是否已经有退款记录
    // 3. 验证退款金额是否合理
    // 4. 插入到退款记录表

    console.log('创建退款记录:', newRefund);

    return NextResponse.json({
      success: true,
      data: newRefund,
      message: '退款记录创建成功',
    });
  } catch (error) {
    console.error('创建退款记录失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据验证失败',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建退款记录失败',
      },
      { status: 500 }
    );
  }
}

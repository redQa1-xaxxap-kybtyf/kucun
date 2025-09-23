// 产品入库API路由
// 提供入库记录的CRUD操作接口

import { type NextRequest, NextResponse } from 'next/server';

import {
  createInboundRecord,
  getInboundRecords,
  parseInboundQueryParams,
  updateInventoryQuantity,
  validateUserSession,
} from '@/lib/api/inbound-handlers';
import { createInboundSchema } from '@/lib/validations/inbound';

// GET /api/inventory/inbound - 获取入库记录列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    await validateUserSession();

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const queryData = parseInboundQueryParams(searchParams);

    // 获取入库记录列表
    const response = await getInboundRecords(queryData);
    return NextResponse.json(response);
  } catch (error) {
    console.error('获取入库记录失败:', error);
    return NextResponse.json(
      { success: false, error: '获取入库记录失败' },
      { status: 500 }
    );
  }
}

// POST /api/inventory/inbound - 创建入库记录
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await validateUserSession();

    // 解析请求体
    const body = await request.json();
    const validatedData = createInboundSchema.parse(body);

    // 创建入库记录
    const inboundRecord = await createInboundRecord(
      validatedData,
      session.user.id
    );

    // 更新库存数量
    await updateInventoryQuantity(
      validatedData.productId,
      validatedData.batchNumber || null,
      validatedData.quantity,
      {
        variantId: validatedData.variantId,
      }
    );

    return NextResponse.json({
      success: true,
      data: inboundRecord,
    });
  } catch (error) {
    console.error('创建入库记录失败:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: '创建入库记录失败' },
      { status: 500 }
    );
  }
}

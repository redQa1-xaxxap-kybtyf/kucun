import { NextResponse } from 'next/server';

import { withAuth } from '@/lib/auth/api-helpers';
import {
  generateSalesOrderNumber,
  isOrderNumberExists,
  validateOrderNumberFormat,
} from '@/lib/services/simple-order-number-generator';

/**
 * 生成或验证销售订单号API
 * 使用新的安全订单号生成服务，保证并发安全
 */

export const POST = withAuth(
  async request => {
    let payload: unknown = null;

    try {
      payload = await request.json();
    } catch {
      // ignore invalid or empty body
    }

    const maybeOrderNumber =
      typeof payload === 'object' && payload !== null
        ? (payload as { orderNumber?: string }).orderNumber
        : undefined;

    if (typeof maybeOrderNumber === 'string') {
      const orderNumber = maybeOrderNumber.trim();
      if (!orderNumber) {
        return NextResponse.json(
          {
            success: false,
            error: '订单号不能为空',
          },
          { status: 400 }
        );
      }

      const formatCheck = validateOrderNumberFormat(orderNumber);
      if (!formatCheck.valid) {
        return NextResponse.json({
          success: true,
          data: {
            valid: false,
            available: false,
            message: formatCheck.message,
          },
        });
      }

      const exists = await isOrderNumberExists(orderNumber);
      return NextResponse.json({
        success: true,
        data: {
          valid: true,
          available: !exists,
          message: exists ? '订单号已存在，请重新生成' : '订单号可用',
        },
      });
    }

    const orderNumber = await generateSalesOrderNumber();

    return NextResponse.json({
      success: true,
      data: {
        orderNumber,
        generatedAt: new Date().toISOString(),
      },
    });
  },
  { permissions: ['orders:create'] }
);

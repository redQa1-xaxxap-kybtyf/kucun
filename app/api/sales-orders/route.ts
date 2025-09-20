import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';

// 销售订单查询参数验证
const salesOrderQuerySchema = z.object({
  page: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 1))
    .refine(val => val > 0, '页码必须大于0'),
  limit: z
    .string()
    .nullable()
    .optional()
    .transform(val => (val ? parseInt(val) : 20))
    .refine(val => val > 0 && val <= 100, '每页数量必须在1-100之间'),
  search: z
    .string()
    .nullable()
    .optional()
    .transform(val => val?.trim() || undefined),
  sortBy: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || 'createdAt')
    .refine(
      val =>
        [
          'orderNumber',
          'createdAt',
          'updatedAt',
          'totalAmount',
          'status',
        ].includes(val),
      '排序字段不正确'
    ),
  sortOrder: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || 'desc')
    .refine(val => ['asc', 'desc'].includes(val), '排序方向不正确'),
  status: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || undefined)
    .refine(
      val =>
        !val ||
        ['draft', 'confirmed', 'shipped', 'completed', 'cancelled'].includes(
          val
        ),
      '状态值不正确'
    ),
  customerId: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || undefined)
    .refine(
      val =>
        !val ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val
        ),
      '客户ID格式不正确'
    ),
  userId: z
    .string()
    .nullable()
    .optional()
    .transform(val => val || undefined)
    .refine(
      val =>
        !val ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          val
        ),
      '用户ID格式不正确'
    ),
});

// 生成订单号
function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const timestamp = now.getTime().toString().slice(-6);
  return `SO${year}${month}${day}${timestamp}`;
}

// 获取销售订单列表
export async function GET(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const rawParams = {
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      sortBy: searchParams.get('sortBy'),
      sortOrder: searchParams.get('sortOrder'),
      status: searchParams.get('status'),
      customerId: searchParams.get('customerId'),
      userId: searchParams.get('userId'),
    };

    // 验证查询参数
    const validationResult = salesOrderQuerySchema.safeParse(rawParams);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '查询参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
      customerId,
      userId,
    } = validationResult.data;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { customer: { name: { contains: search } } },
        { remarks: { contains: search } },
      ];
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (userId) {
      where.userId = userId;
    }

    // 查询销售订单列表
    const [salesOrders, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where,
        select: {
          id: true,
          orderNumber: true,
          customerId: true,
          userId: true,
          status: true,
          totalAmount: true,
          remarks: true,
          createdAt: true,
          updatedAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            select: {
              id: true,
              productId: true,
              colorCode: true,
              productionDate: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              product: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  unit: true,
                },
              },
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.salesOrder.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 转换数据格式（snake_case -> camelCase）
    const formattedSalesOrders = salesOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      userId: order.userId,
      status: order.status,
      totalAmount: order.totalAmount,
      remarks: order.remarks,
      customer: order.customer,
      user: order.user,
      items: order.items.map(item => ({
        id: item.id,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
      })),
      itemsCount: order._count.items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedSalesOrders,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('获取销售订单列表错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取销售订单列表失败',
      },
      { status: 500 }
    );
  }
}

// 创建销售订单
export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = salesOrderCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '输入数据格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const {
      customerId,
      items,
      remarks,
      orderNumber: providedOrderNumber,
    } = validationResult.data;

    // 验证客户是否存在
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: '指定的客户不存在' },
        { status: 400 }
      );
    }

    // 验证所有产品是否存在
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, status: true },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { success: false, error: '存在无效的产品' },
        { status: 400 }
      );
    }

    // 检查产品状态
    const inactiveProducts = products.filter(p => p.status !== 'active');
    if (inactiveProducts.length > 0) {
      return NextResponse.json(
        { success: false, error: '存在已停用的产品，无法创建订单' },
        { status: 400 }
      );
    }

    // 计算总金额
    const totalAmount = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    // 使用提供的订单号或生成新的订单号
    const orderNumber = providedOrderNumber || generateOrderNumber();

    // 使用事务创建销售订单
    const salesOrder = await prisma.$transaction(async tx => {
      // 创建销售订单
      const order = await tx.salesOrder.create({
        data: {
          orderNumber,
          customerId,
          userId: session.user.id,
          status: 'draft',
          totalAmount,
          remarks,
        },
      });

      // 创建订单明细
      const orderItems = await Promise.all(
        items.map(item =>
          tx.salesOrderItem.create({
            data: {
              salesOrderId: order.id,
              productId: item.productId,
              colorCode: item.colorCode,
              productionDate: item.productionDate,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.quantity * item.unitPrice,
            },
          })
        )
      );

      return { order, items: orderItems };
    });

    // 获取完整的订单信息
    const fullOrder = await prisma.salesOrder.findUnique({
      where: { id: salesOrder.order.id },
      select: {
        id: true,
        orderNumber: true,
        customerId: true,
        userId: true,
        status: true,
        totalAmount: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            productId: true,
            colorCode: true,
            productionDate: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
              },
            },
          },
        },
      },
    });

    // 转换数据格式
    if (!fullOrder) {
      return NextResponse.json(
        { success: false, error: '订单创建失败' },
        { status: 500 }
      );
    }

    const formattedOrder = {
      id: fullOrder.id,
      orderNumber: fullOrder.orderNumber,
      customerId: fullOrder.customerId,
      userId: fullOrder.userId,
      status: fullOrder.status,
      totalAmount: fullOrder.totalAmount,
      remarks: fullOrder.remarks,
      customer: fullOrder.customer,
      user: fullOrder.user,
      items: fullOrder.items.map(item => ({
        id: item.id,
        productId: item.productId,
        colorCode: item.colorCode,
        productionDate: item.productionDate,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        product: item.product,
      })),
      createdAt: fullOrder.createdAt,
      updatedAt: fullOrder.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedOrder,
      message: '销售订单创建成功',
    });
  } catch (error) {
    console.error('创建销售订单错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建销售订单失败',
      },
      { status: 500 }
    );
  }
}

import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 获取单个客户信息
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        extendedInfo: true,
        parentCustomerId: true,
        createdAt: true,
        updatedAt: true,
        parentCustomer: {
          select: {
            id: true,
            name: true,
          },
        },
        salesOrders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // 最近10个订单
        },
        _count: {
          select: {
            salesOrders: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: '客户不存在' },
        { status: 404 }
      );
    }

    // 转换数据格式
    const formattedCustomer = {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      extendedInfo: customer.extendedInfo
        ? JSON.parse(customer.extendedInfo as string)
        : null,
      parentCustomerId: customer.parentCustomerId,
      parentCustomer: customer.parentCustomer,
      subCustomers: [], // 暂时设为空数组，后续可以通过单独查询获取
      recentSalesOrders: customer.salesOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
      })),
      statistics: {
        subCustomersCount: 0, // 暂时设为0，后续可以通过单独查询获取
        salesOrdersCount: customer._count.salesOrders,
      },
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedCustomer,
    });
  } catch (error) {
    console.error('获取客户信息错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取客户信息失败',
      },
      { status: 500 }
    );
  }
}

// 更新客户信息
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const validationResult = customerUpdateSchema.safeParse({
      id: params.id,
      ...body,
    });
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

    const { name, phone, address, extendedInfo, parentCustomerId } =
      validationResult.data;

    // 检查客户是否存在
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, error: '客户不存在' },
        { status: 404 }
      );
    }

    // 如果指定了上级客户，验证其存在性和循环引用
    if (parentCustomerId) {
      if (parentCustomerId === params.id) {
        return NextResponse.json(
          { success: false, error: '不能将自己设置为上级客户' },
          { status: 400 }
        );
      }

      const parentCustomer = await prisma.customer.findUnique({
        where: { id: parentCustomerId },
      });

      if (!parentCustomer) {
        return NextResponse.json(
          { success: false, error: '指定的上级客户不存在' },
          { status: 400 }
        );
      }

      // 检查是否会形成循环引用
      const checkCircularReference = async (
        customerId: string,
        targetParentId: string
      ): Promise<boolean> => {
        let currentId = targetParentId;
        while (currentId) {
          if (currentId === customerId) {
            return true; // 发现循环引用
          }
          const parent = await prisma.customer.findUnique({
            where: { id: currentId },
            select: { parentCustomerId: true },
          });
          currentId = parent?.parentCustomerId || '';
        }
        return false;
      };

      const hasCircularReference = await checkCircularReference(
        params.id,
        parentCustomerId
      );
      if (hasCircularReference) {
        return NextResponse.json(
          { success: false, error: '不能设置会形成循环引用的上级客户' },
          { status: 400 }
        );
      }
    }

    // 更新客户信息
    const updatedCustomer = await prisma.customer.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(address !== undefined && { address }),
        ...(extendedInfo !== undefined && {
          extendedInfo: extendedInfo ? JSON.stringify(extendedInfo) : null,
        }),
        ...(parentCustomerId !== undefined && { parentCustomerId }),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        extendedInfo: true,
        parentCustomerId: true,
        createdAt: true,
        updatedAt: true,
        parentCustomer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // 转换数据格式
    const formattedCustomer = {
      id: updatedCustomer.id,
      name: updatedCustomer.name,
      phone: updatedCustomer.phone,
      address: updatedCustomer.address,
      extendedInfo: updatedCustomer.extendedInfo
        ? JSON.parse(updatedCustomer.extendedInfo as string)
        : null,
      parentCustomerId: updatedCustomer.parentCustomerId,
      parentCustomer: updatedCustomer.parentCustomer,
      createdAt: updatedCustomer.createdAt,
      updatedAt: updatedCustomer.updatedAt,
    };

    return NextResponse.json({
      success: true,
      data: formattedCustomer,
      message: '客户信息更新成功',
    });
  } catch (error) {
    console.error('更新客户信息错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新客户信息失败',
      },
      { status: 500 }
    );
  }
}

// 删除客户（软删除，实际上是检查关联后禁止删除）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 验证用户权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 检查客户是否存在
    const existingCustomer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        salesOrders: true,
      },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, error: '客户不存在' },
        { status: 404 }
      );
    }

    // 检查是否有关联数据
    if (existingCustomer.salesOrders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `该客户有 ${existingCustomer.salesOrders.length} 个销售订单，无法删除`,
        },
        { status: 400 }
      );
    }

    // 删除客户
    await prisma.customer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: '客户删除成功',
    });
  } catch (error) {
    console.error('删除客户错误:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除客户失败',
      },
      { status: 500 }
    );
  }
}

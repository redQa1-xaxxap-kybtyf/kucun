// 仪表盘小部件管理API
// 用户自定义仪表盘布局和小部件的CRUD操作

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  dashboardWidgetCreateSchema,
  dashboardWidgetUpdateSchema,
  dashboardWidgetBatchUpdateSchema,
  apiResponseSchema,
  paginatedResponseSchema,
} from '@/lib/validations/dashboard';

// 获取用户的仪表盘小部件列表
export async function GET(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const visible = searchParams.get('visible');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // 构建查询条件
    const whereConditions: any = {
      userId: session.user.id,
    };

    if (type) {
      whereConditions.type = type;
    }

    if (visible !== null) {
      whereConditions.visible = visible === 'true';
    }

    // 获取小部件列表
    const [widgets, total] = await Promise.all([
      prisma.dashboardWidget.findMany({
        where: whereConditions,
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.dashboardWidget.count({
        where: whereConditions,
      }),
    ]);

    // 转换数据格式
    const responseData = widgets.map(widget => ({
      id: widget.id,
      userId: widget.userId,
      type: widget.type,
      title: widget.title,
      size: widget.size,
      position: JSON.parse(widget.position),
      config: widget.config ? JSON.parse(widget.config) : null,
      visible: widget.visible,
      refreshable: widget.refreshable,
      sortOrder: widget.sortOrder,
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: responseData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('获取仪表盘小部件失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取仪表盘小部件失败',
      },
      { status: 500 }
    );
  }
}

// 创建新的仪表盘小部件
export async function POST(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validationResult = dashboardWidgetCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const widgetData = validationResult.data;

    // 创建小部件
    const newWidget = await prisma.dashboardWidget.create({
      data: {
        userId: session.user.id,
        type: widgetData.type,
        title: widgetData.title,
        size: widgetData.size,
        position: JSON.stringify(widgetData.position),
        config: widgetData.config ? JSON.stringify(widgetData.config) : null,
        visible: widgetData.visible,
        refreshable: widgetData.refreshable,
        sortOrder: widgetData.sortOrder,
      },
    });

    // 转换响应数据
    const responseData = {
      id: newWidget.id,
      userId: newWidget.userId,
      type: newWidget.type,
      title: newWidget.title,
      size: newWidget.size,
      position: JSON.parse(newWidget.position),
      config: newWidget.config ? JSON.parse(newWidget.config) : null,
      visible: newWidget.visible,
      refreshable: newWidget.refreshable,
      sortOrder: newWidget.sortOrder,
      createdAt: newWidget.createdAt.toISOString(),
      updatedAt: newWidget.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: '仪表盘小部件创建成功',
    });
  } catch (error) {
    console.error('创建仪表盘小部件失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '创建仪表盘小部件失败',
      },
      { status: 500 }
    );
  }
}

// 批量更新仪表盘小部件
export async function PUT(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();

    // 验证输入数据
    const validationResult = dashboardWidgetBatchUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: '请求参数格式不正确',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { widgets } = validationResult.data;

    // 验证所有小部件都属于当前用户
    const widgetIds = widgets.map(w => w.id);
    const existingWidgets = await prisma.dashboardWidget.findMany({
      where: {
        id: { in: widgetIds },
        userId: session.user.id,
      },
      select: { id: true },
    });

    if (existingWidgets.length !== widgetIds.length) {
      return NextResponse.json(
        { success: false, error: '部分小部件不存在或无权限访问' },
        { status: 403 }
      );
    }

    // 批量更新小部件
    const updatePromises = widgets.map(widget => {
      const { id, ...updateData } = widget;
      
      // 处理JSON字段
      const dbUpdateData: any = { ...updateData };
      if (updateData.position) {
        dbUpdateData.position = JSON.stringify(updateData.position);
      }
      if (updateData.config) {
        dbUpdateData.config = JSON.stringify(updateData.config);
      }

      return prisma.dashboardWidget.update({
        where: { id },
        data: dbUpdateData,
      });
    });

    const updatedWidgets = await Promise.all(updatePromises);

    // 转换响应数据
    const responseData = updatedWidgets.map(widget => ({
      id: widget.id,
      userId: widget.userId,
      type: widget.type,
      title: widget.title,
      size: widget.size,
      position: JSON.parse(widget.position),
      config: widget.config ? JSON.parse(widget.config) : null,
      visible: widget.visible,
      refreshable: widget.refreshable,
      sortOrder: widget.sortOrder,
      createdAt: widget.createdAt.toISOString(),
      updatedAt: widget.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: responseData,
      message: '仪表盘小部件批量更新成功',
    });
  } catch (error) {
    console.error('批量更新仪表盘小部件失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '批量更新仪表盘小部件失败',
      },
      { status: 500 }
    );
  }
}

// 删除仪表盘小部件
export async function DELETE(request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const widgetId = searchParams.get('id');

    if (!widgetId) {
      return NextResponse.json(
        { success: false, error: '缺少小部件ID参数' },
        { status: 400 }
      );
    }

    // 验证小部件存在且属于当前用户
    const existingWidget = await prisma.dashboardWidget.findFirst({
      where: {
        id: widgetId,
        userId: session.user.id,
      },
    });

    if (!existingWidget) {
      return NextResponse.json(
        { success: false, error: '小部件不存在或无权限访问' },
        { status: 404 }
      );
    }

    // 删除小部件
    await prisma.dashboardWidget.delete({
      where: { id: widgetId },
    });

    return NextResponse.json({
      success: true,
      message: '仪表盘小部件删除成功',
    });
  } catch (error) {
    console.error('删除仪表盘小部件失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除仪表盘小部件失败',
      },
      { status: 500 }
    );
  }
}

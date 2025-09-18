import { getServerSession } from 'next-auth';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';

// 获取快速操作数据
export async function GET(_request: NextRequest) {
  try {
    // 身份验证
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未授权访问' },
        { status: 401 }
      );
    }

    // 根据用户角色定义快速操作
    const isAdmin = session.user.role === 'admin';
    const isSales = session.user.role === 'sales';

    const quickActions = [];

    // 销售相关操作
    if (isSales || isAdmin) {
      quickActions.push(
        {
          id: 'create-sales-order',
          title: '创建销售订单',
          description: '快速创建新的销售订单',
          icon: 'plus-circle',
          color: 'blue',
          href: '/sales-orders/create',
          category: 'sales',
          priority: 1,
        },
        {
          id: 'view-customers',
          title: '客户管理',
          description: '查看和管理客户信息',
          icon: 'users',
          color: 'green',
          href: '/customers',
          category: 'customer',
          priority: 2,
        },
        {
          id: 'check-inventory',
          title: '库存查询',
          description: '快速查看产品库存状态',
          icon: 'package',
          color: 'orange',
          href: '/inventory',
          category: 'inventory',
          priority: 3,
        }
      );
    }

    // 管理员专用操作
    if (isAdmin) {
      quickActions.push(
        {
          id: 'create-product',
          title: '添加产品',
          description: '添加新的产品到系统',
          icon: 'plus',
          color: 'purple',
          href: '/products/create',
          category: 'product',
          priority: 4,
        },
        {
          id: 'inventory-adjust',
          title: '库存调整',
          description: '调整产品库存数量',
          icon: 'edit',
          color: 'yellow',
          href: '/inventory/adjust',
          category: 'inventory',
          priority: 5,
        },
        {
          id: 'user-management',
          title: '用户管理',
          description: '管理系统用户和权限',
          icon: 'user-cog',
          color: 'red',
          href: '/users',
          category: 'admin',
          priority: 6,
        }
      );
    }

    // 通用操作
    quickActions.push(
      {
        id: 'reports',
        title: '销售报表',
        description: '查看销售统计和报表',
        icon: 'bar-chart',
        color: 'indigo',
        href: '/reports',
        category: 'report',
        priority: 7,
      },
      {
        id: 'settings',
        title: '系统设置',
        description: '配置系统参数和偏好',
        icon: 'settings',
        color: 'gray',
        href: '/settings',
        category: 'system',
        priority: 8,
      }
    );

    // 按优先级排序
    quickActions.sort((a, b) => a.priority - b.priority);

    return NextResponse.json({
      success: true,
      data: quickActions,
    });
  } catch (error) {
    console.error('获取快速操作失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取快速操作失败',
      },
      { status: 500 }
    );
  }
}

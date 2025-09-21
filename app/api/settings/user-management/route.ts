/**
 * 用户管理设置API路由
 * 处理角色权限、密码策略、会话管理等用户安全设置
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  type SettingsResponse,
  type UserManagementSettings,
} from '@/lib/types/settings';
import { UserManagementSettingsSchema } from '@/lib/validations/settings';

/**
 * GET /api/settings/user-management - 获取用户管理设置
 */
export async function GET(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以查看用户管理设置' },
        { status: 403 }
      );
    }

    // 从数据库获取用户管理设置
    // TODO: 实际项目中从数据库获取
    const userManagementSettings: UserManagementSettings =
      DEFAULT_SETTINGS.userManagement;

    return NextResponse.json({
      success: true,
      data: { userManagement: userManagementSettings },
      message: '获取用户管理设置成功',
    });
  } catch (error) {
    console.error('获取用户管理设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取用户管理设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/user-management - 更新用户管理设置
 */
export async function PUT(
  request: NextRequest
): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以修改用户管理设置' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证输入数据
    const validationResult = UserManagementSettingsSchema.safeParse(body);
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

    const updatedUserManagementSettings = validationResult.data;

    // 验证密码策略的逻辑一致性
    if (
      !updatedUserManagementSettings.passwordRequireUppercase &&
      !updatedUserManagementSettings.passwordRequireLowercase &&
      !updatedUserManagementSettings.passwordRequireNumbers &&
      !updatedUserManagementSettings.passwordRequireSpecialChars
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '密码策略至少需要启用一种字符要求',
        },
        { status: 400 }
      );
    }

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     userManagement: updatedUserManagementSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    // 模拟保存成功
    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      userManagement: updatedUserManagementSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: updatedSettings,
      message: '用户管理设置更新成功',
    });
  } catch (error) {
    console.error('更新用户管理设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '更新用户管理设置失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/user-management/reset - 重置用户管理设置为默认值
 */
export async function POST(): Promise<NextResponse<SettingsResponse>> {
  try {
    // 验证管理员权限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可以重置用户管理设置' },
        { status: 403 }
      );
    }

    const defaultUserManagementSettings = DEFAULT_SETTINGS.userManagement;

    // TODO: 保存到数据库
    // await prisma.settings.update({
    //   where: { id: 'system' },
    //   data: {
    //     userManagement: defaultUserManagementSettings,
    //     updatedAt: new Date(),
    //     updatedBy: session.user.id,
    //   },
    // });

    const resetSettings = {
      ...DEFAULT_SETTINGS,
      userManagement: defaultUserManagementSettings,
      updatedAt: new Date(),
      updatedBy: session.user.id,
    };

    return NextResponse.json({
      success: true,
      data: resetSettings,
      message: '用户管理设置已重置为默认值',
    });
  } catch (error) {
    console.error('重置用户管理设置失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '重置用户管理设置失败',
      },
      { status: 500 }
    );
  }
}

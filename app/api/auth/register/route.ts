import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

/**
 * 用户注册接口已禁用
 *
 * 本系统不允许用户自主注册。
 * 新用户只能由管理员通过以下方式创建：
 * 1. 使用数据库脚本：npx tsx scripts/create-correct-admin.ts
 * 2. 通过管理员后台的用户管理功能（如果已实现）
 */
export async function POST() {
  logger.warn('auth-register', '尝试访问已禁用的注册接口');

  return NextResponse.json(
    {
      success: false,
      error: '用户注册功能已禁用',
      message: '本系统不允许用户自主注册，请联系管理员创建账户',
    },
    { status: 403 }
  );
}

/**
 * 系统设置变更日志工具
 * 用于记录配置变更历史
 * 严格遵循全局约定规范
 */

import { prisma } from '@/lib/db';

/**
 * 记录设置变更日志
 * @param settingKey 设置键
 * @param oldValue 旧值
 * @param newValue 新值
 * @param changedBy 变更人ID
 * @param ipAddress IP地址
 * @param userAgent 用户代理
 * @param remarks 备注
 */
export async function logSettingChange(
  settingKey: string,
  oldValue: string | null,
  newValue: string,
  changedBy: string,
  ipAddress?: string,
  userAgent?: string,
  remarks?: string
): Promise<void> {
  try {
    await prisma.settingChangeLog.create({
      data: {
        settingKey,
        oldValue,
        newValue,
        changedBy,
        ipAddress,
        userAgent,
        remarks,
      },
    });
  } catch (error) {
    console.error('记录设置变更日志失败:', error);
    // 不抛出错误,避免影响主流程
  }
}

/**
 * 批量记录设置变更日志
 * @param changes 变更列表
 * @param changedBy 变更人ID
 * @param ipAddress IP地址
 * @param userAgent 用户代理
 */
export async function logSettingChanges(
  changes: Array<{
    settingKey: string;
    oldValue: string | null;
    newValue: string;
    remarks?: string;
  }>,
  changedBy: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.settingChangeLog.createMany({
      data: changes.map(change => ({
        settingKey: change.settingKey,
        oldValue: change.oldValue,
        newValue: change.newValue,
        changedBy,
        ipAddress,
        userAgent,
        remarks: change.remarks,
      })),
    });
  } catch (error) {
    console.error('批量记录设置变更日志失败:', error);
    // 不抛出错误,避免影响主流程
  }
}

/**
 * 获取设置变更历史
 * @param settingKey 设置键
 * @param limit 限制数量
 * @returns 变更历史列表
 */
export async function getSettingChangeHistory(
  settingKey: string,
  limit: number = 50
) {
  return await prisma.settingChangeLog.findMany({
    where: {
      settingKey,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
    },
    orderBy: {
      changedAt: 'desc',
    },
    take: limit,
  });
}

/**
 * 获取所有设置变更历史
 * @param page 页码
 * @param limit 每页数量
 * @returns 分页的变更历史列表
 */
export async function getAllSettingChangeHistory(
  page: number = 1,
  limit: number = 50
) {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.settingChangeLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.settingChangeLog.count(),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}


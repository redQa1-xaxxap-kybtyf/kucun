import { prisma } from '@/lib/db';

export const SYSTEM_WRITE_LOCK_SETTING_KEY = 'system_write_lock';

export type SystemWriteLock = {
  locked: boolean;
  taskId: string;
  action: string;
  lockedAt: string;
  lockedBy: string;
  expiresAt: string;
};

function safeParseJson(input: string | null | undefined): unknown {
  if (!input) {
    return null;
  }
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function isValidLock(value: unknown): value is SystemWriteLock {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const lock = value as Partial<SystemWriteLock>;
  return (
    typeof lock.locked === 'boolean' &&
    typeof lock.taskId === 'string' &&
    typeof lock.action === 'string' &&
    typeof lock.lockedAt === 'string' &&
    typeof lock.lockedBy === 'string' &&
    typeof lock.expiresAt === 'string'
  );
}

export async function getSystemWriteLock(): Promise<SystemWriteLock | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_WRITE_LOCK_SETTING_KEY },
    select: { value: true },
  });
  const parsed = safeParseJson(setting?.value);
  if (!isValidLock(parsed)) {
    return null;
  }
  return parsed.locked ? parsed : null;
}

export async function setSystemWriteLock(lock: SystemWriteLock): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_WRITE_LOCK_SETTING_KEY },
    create: {
      key: SYSTEM_WRITE_LOCK_SETTING_KEY,
      value: JSON.stringify(lock),
      category: 'basic',
      dataType: 'json',
      isPublic: false,
      description: '系统写入锁（数据管理任务运行中启用）',
    },
    update: {
      value: JSON.stringify(lock),
      category: 'basic',
      dataType: 'json',
      isPublic: false,
      description: '系统写入锁（数据管理任务运行中启用）',
    },
  });
}

export async function clearSystemWriteLock(taskId: string): Promise<void> {
  const current = await getSystemWriteLock();
  if (!current) {
    return;
  }
  if (current.taskId !== taskId) {
    return;
  }

  await prisma.systemSetting.updateMany({
    where: { key: SYSTEM_WRITE_LOCK_SETTING_KEY },
    data: {
      value: JSON.stringify({ ...current, locked: false }),
      dataType: 'json',
    },
  });
}

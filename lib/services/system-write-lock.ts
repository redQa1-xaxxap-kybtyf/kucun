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

type CompactSystemWriteLock = {
  l: boolean;
  t: string;
  a: string;
  s: string;
  b: string;
  e: string;
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

function isValidCompactLock(value: unknown): value is CompactSystemWriteLock {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const lock = value as Partial<CompactSystemWriteLock>;
  return (
    typeof lock.l === 'boolean' &&
    typeof lock.t === 'string' &&
    typeof lock.a === 'string' &&
    typeof lock.s === 'string' &&
    typeof lock.b === 'string' &&
    typeof lock.e === 'string'
  );
}

function normaliseLock(value: unknown): SystemWriteLock | null {
  if (isValidLock(value)) {
    return value;
  }

  if (isValidCompactLock(value)) {
    return {
      locked: value.l,
      taskId: value.t,
      action: value.a,
      lockedAt: value.s,
      lockedBy: value.b,
      expiresAt: value.e,
    };
  }

  return null;
}

function serialiseLock(lock: SystemWriteLock): string {
  // 使用短字段名，兼容尚未迁移到 TEXT 的旧库（历史上 value 列可能不足 191 字符）。
  return JSON.stringify({
    l: lock.locked,
    t: lock.taskId,
    a: lock.action,
    s: lock.lockedAt,
    b: lock.lockedBy,
    e: lock.expiresAt,
  } satisfies CompactSystemWriteLock);
}

export async function getSystemWriteLock(): Promise<SystemWriteLock | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_WRITE_LOCK_SETTING_KEY },
    select: { value: true },
  });
  const parsed = normaliseLock(safeParseJson(setting?.value));
  if (!parsed) {
    return null;
  }
  return parsed.locked ? parsed : null;
}

export async function setSystemWriteLock(lock: SystemWriteLock): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_WRITE_LOCK_SETTING_KEY },
    create: {
      key: SYSTEM_WRITE_LOCK_SETTING_KEY,
      value: serialiseLock(lock),
      category: 'basic',
      dataType: 'json',
      isPublic: false,
      description: '系统写入锁（数据管理任务运行中启用）',
    },
    update: {
      value: serialiseLock(lock),
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
      value: serialiseLock({ ...current, locked: false }),
      dataType: 'json',
    },
  });
}

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import type { SystemMode } from '@/lib/types/system-mode';

import { SYSTEM_MODE_SETTING_KEY } from '@/lib/types/system-mode';

function getDefaultSystemMode(): SystemMode {
  // 开发环境默认试用模式，避免“刚跑起来就是正式账套(受保护)”导致体验割裂。
  // 生产环境始终默认正式模式，避免误把生产当试用。
  return env.NODE_ENV === 'development' ? 'trial' : 'production';
}

function normaliseSystemMode(value: string | null | undefined): SystemMode {
  return value === 'trial' || value === 'production' ? value : getDefaultSystemMode();
}

export async function getSystemMode(): Promise<SystemMode> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: SYSTEM_MODE_SETTING_KEY },
    select: { value: true },
  });
  return normaliseSystemMode(setting?.value);
}

export async function setSystemMode(mode: SystemMode): Promise<SystemMode> {
  const nextMode = normaliseSystemMode(mode);
  await prisma.systemSetting.upsert({
    where: { key: SYSTEM_MODE_SETTING_KEY },
    create: {
      key: SYSTEM_MODE_SETTING_KEY,
      value: nextMode,
      category: 'basic',
      dataType: 'string',
      isPublic: false,
      description: '系统账套模式（trial/production）',
    },
    update: {
      value: nextMode,
      category: 'basic',
      dataType: 'string',
      isPublic: false,
      description: '系统账套模式（trial/production）',
    },
  });
  return nextMode;
}

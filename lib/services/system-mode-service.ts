import { prisma } from '@/lib/db';
import type { SystemMode } from '@/lib/types/system-mode';

import { SYSTEM_MODE_SETTING_KEY } from '@/lib/types/system-mode';

function normaliseSystemMode(value: string | null | undefined): SystemMode {
  return value === 'trial' || value === 'production' ? value : 'production';
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


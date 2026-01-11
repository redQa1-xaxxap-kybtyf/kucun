import { prisma } from '@/lib/db';
import { parseExtendedInfo } from '@/lib/validations/customer';

const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export async function ensureUniquePhoneInRegion(
  phone?: string | null,
  region?: string | null,
  excludeCustomerId?: string
) {
  const normalizedPhone = normalizeText(phone);
  const normalizedRegion = normalizeText(region);

  if (!normalizedPhone || !normalizedRegion) {
    return;
  }

  const where = {
    phone: normalizedPhone,
    ...(excludeCustomerId ? { NOT: { id: excludeCustomerId } } : {}),
  };

  const pageSize = 1000;
  let cursorId: string | undefined;

  while (true) {
    const candidates = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        extendedInfo: true,
      },
      orderBy: { id: 'asc' },
      take: pageSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    const hasConflict = candidates.some(candidate => {
      const info = parseExtendedInfo(candidate.extendedInfo || undefined);
      const candidateRegion = normalizeText(info.region);
      return candidateRegion === normalizedRegion;
    });

    if (hasConflict) {
      throw new Error(
        `地区「${normalizedRegion}」已存在使用手机号 ${normalizedPhone} 的客户，请检查后再试。`
      );
    }

    if (candidates.length < pageSize) {
      break;
    }

    cursorId = candidates[candidates.length - 1]?.id;
    if (!cursorId) {
      break;
    }
  }
}

export async function checkHierarchyLoop(
  customerId: string,
  newParentId: string
): Promise<boolean> {
  if (customerId === newParentId) {
    return true;
  }

  let currentParentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentParentId) {
    if (visited.has(currentParentId)) {
      return true;
    }

    if (currentParentId === customerId) {
      return true;
    }

    visited.add(currentParentId);

    const parent: { parentCustomerId: string | null } | null =
      await prisma.customer.findUnique({
        where: { id: currentParentId },
        select: { parentCustomerId: true },
      });

    currentParentId = parent?.parentCustomerId || null;
  }

  return false;
}

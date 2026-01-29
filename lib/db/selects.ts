import type { Prisma } from '@prisma/client';

/**
 * Prisma select helpers for preventing over-fetching.
 * Keep this file focused: only add selects that are reused.
 */

export const userSafeSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userBasicSelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

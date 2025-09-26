import crypto from 'node:crypto';

import { redis } from '@/lib/redis/redis-client';

export interface CacheOptions {
  ttlSeconds?: number;
  namespace: 'products:list' | 'inventory:list' | string;
}

export function buildCacheKey(
  namespace: string,
  params: Record<string, unknown>
): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      // Only include defined & primitive-like values
      const v = (params as Record<string, unknown>)[k];
      if (v !== undefined && v !== null && v !== '') acc[k] = v;
      return acc;
    }, {});
  const hash = crypto
    .createHash('sha1')
    .update(JSON.stringify(sorted))
    .digest('hex')
    .slice(0, 16);
  return `${namespace}:${hash}`;
}

export async function getOrSetJSON<T>(
  key: string,
  fetcher: (() => Promise<T>) | null,
  ttlSeconds?: number
): Promise<T | null> {
  const cached = await redis.getJson<T>(key);
  if (cached) return cached;

  // 如果fetcher为null，只返回缓存结果
  if (fetcher === null) return null;

  const fresh = await fetcher();
  await redis.setJson<T>(key, fresh, ttlSeconds);
  return fresh;
}

export async function invalidateNamespace(
  namespacePattern: string
): Promise<number> {
  // pattern example: 'products:list:*'
  return redis.scanDel(namespacePattern);
}

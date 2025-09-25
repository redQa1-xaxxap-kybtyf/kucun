import Redis from 'ioredis';

import { env } from '@/lib/env';

export interface RedisClientWrapper {
  getClient(): Redis;
  getJson<T>(key: string): Promise<T | null>;
  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<'OK' | null>;
  del(key: string): Promise<number>;
  scanDel(pattern: string): Promise<number>;
}

const poolSize = Number(process.env.REDIS_POOL_SIZE || 3);
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const namespace = process.env.REDIS_NAMESPACE || 'kucun';

// 开发环境降级模式：如果Redis不可用，使用内存缓存（暂时保留用于未来扩展）
// const isDevelopment = process.env.NODE_ENV === 'development';
// const memoryCache = new Map<string, { value: unknown; expiry: number }>();

function createClient(url: string) {
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true,
    lazyConnect: false,
    retryStrategy: (times: number) => Math.min(1000 * 2 ** times, 30_000),
  });

  client.on('error', (err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[Redis] error:', err);
  });
  client.on('connect', () => {
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Redis] connected');
    }
  });
  client.on('reconnecting', () => {
    if (env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('[Redis] reconnecting...');
    }
  });

  return client;
}

// Simple round-robin pool
const pool: Redis[] = Array.from({ length: poolSize }, () =>
  createClient(redisUrl)
);
let rrIndex = 0;

function prefixed(key: string): string {
  return `${namespace}:${key}`;
}

export const redis: RedisClientWrapper = {
  getClient(): Redis {
    rrIndex = (rrIndex + 1) % pool.length;
    return pool[rrIndex];
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.getClient().get(prefixed(key));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<'OK' | null> {
    const payload = JSON.stringify(value);
    const k = prefixed(key);
    if (ttlSeconds && ttlSeconds > 0) {
      return this.getClient().set(k, payload, 'EX', ttlSeconds);
    }
    return this.getClient().set(k, payload);
  },

  async del(key: string): Promise<number> {
    return this.getClient().del(prefixed(key));
  },

  async scanDel(pattern: string): Promise<number> {
    const client = this.getClient();
    let cursor = '0';
    let deleted = 0;
    const patt = prefixed(pattern);
    do {
      // eslint-disable-next-line no-await-in-loop
      const [next, keys] = await client.scan(
        cursor,
        'MATCH',
        patt,
        'COUNT',
        100
      );
      cursor = next;
      if (keys.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        const n = await client.unlink(...keys);
        deleted += n;
      }
    } while (cursor !== '0');
    return deleted;
  },
};

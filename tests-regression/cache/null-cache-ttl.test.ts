/**
 * P0-3 回归：null/不存在值的缓存 TTL 必须为 3600s，且异常不得写 null-cache
 */

const loggerMock = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: loggerMock,
}));

const store = new Map<string, unknown>();
const ttlByKey = new Map<string, number | undefined>();

const redisMock = {
  getJson: jest.fn(async (key: string) =>
    store.has(key) ? store.get(key) : null
  ),
  setJson: jest.fn(async (key: string, value: unknown, ttlSeconds?: number) => {
    store.set(key, value);
    ttlByKey.set(key, ttlSeconds);
    return 'OK' as const;
  }),
};

jest.mock('@/lib/redis/redis-client', () => ({
  redis: redisMock,
}));

import {
  getOrSetJSON,
  NULL_CACHE_TTL,
  NULL_CACHE_VALUE,
} from '@/lib/cache/cache';

describe('null-cache TTL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    ttlByKey.clear();
  });

  it('不存在结果写入 null-cache，TTL=3600，且二次命中不再回源', async () => {
    const fetcher = jest.fn(async () => null);
    const key = 'key:not-found';

    expect(NULL_CACHE_TTL).toBe(3600);

    const first = await getOrSetJSON(key, fetcher, 60);
    expect(first).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(redisMock.setJson).toHaveBeenCalledWith(
      key,
      NULL_CACHE_VALUE,
      NULL_CACHE_TTL
    );
    expect(ttlByKey.get(key)).toBe(3600);

    const second = await getOrSetJSON(key, fetcher, 60);
    expect(second).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('异常/超时不得写 null-cache', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('boom');
    });
    const key = 'key:error';

    await expect(getOrSetJSON(key, fetcher, 60)).rejects.toThrow('boom');
    expect(redisMock.setJson).not.toHaveBeenCalled();
  });
});

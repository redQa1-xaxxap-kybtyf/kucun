import { jest } from '@jest/globals';

import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { revalidateInventory } from '@/lib/cache/revalidate';

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

jest.mock('@/lib/redis/redis-pubsub', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn(),
}));

jest.mock('@/lib/redis/redis-client', () => ({
  redis: {
    scanDel: jest.fn().mockResolvedValue(0),
    getClient: jest.fn(),
    getConfig: jest.fn(() => ({ namespace: 'kucun' })),
    getJson: jest.fn(),
  },
}));

describe('inventory cache invalidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revalidateInventory(productId) 应同步清理库存摘要、可用性、预警和仪表盘统计缓存', async () => {
    await revalidateInventory('product-1');

    const { redis } = await import('@/lib/redis/redis-client');

    expect(redis.scanDel).toHaveBeenCalledWith('inventory:summary:product-1*');
    expect(redis.scanDel).toHaveBeenCalledWith('inventory:list*');
    expect(redis.scanDel).toHaveBeenCalledWith('inventory:availability:*');
    expect(redis.scanDel).toHaveBeenCalledWith('inventory:alerts*');
    expect(redis.scanDel).toHaveBeenCalledWith('dashboard:stats*');
  });

  it('invalidateInventoryCache(productId) 应复用统一库存缓存失效逻辑', async () => {
    const { redis } = await import('@/lib/redis/redis-client');

    await invalidateInventoryCache('product-2');

    expect(redis.scanDel).toHaveBeenCalledWith('inventory:summary:product-2*');
    expect(redis.scanDel).toHaveBeenCalledWith('inventory:availability:*');
    expect(redis.scanDel).toHaveBeenCalledWith('inventory:alerts*');
    expect(redis.scanDel).toHaveBeenCalledWith('dashboard:stats*');
  });
});

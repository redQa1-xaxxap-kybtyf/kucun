/**
 * 性能基准测试
 * 测试布局组件的渲染性能和缓存系统
 * 严格遵循全栈项目统一约定规范
 */

import {
  globalCache,
  LRUCache,
  performanceUtils,
  useDebounce,
  useThrottle,
} from '@/lib/utils/performance';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';

describe('性能优化工具测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalCache.clear();
  });

  describe('LRUCache', () => {
    it('应该正确存储和获取数据', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 3,
        ttl: 1000,
      });

      cache.set('key1', 100);
      cache.set('key2', 200);
      cache.set('key3', 300);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBe(200);
      expect(cache.get('key3')).toBe(300);
      expect(cache.size()).toBe(3);
    });

    it('应该在达到最大容量时删除最少使用的项', () => {
      const cache = new LRUCache<string, number>({
        maxSize: 2,
        ttl: 1000,
      });

      cache.set('key1', 100);
      cache.set('key2', 200);

      // 访问key1使其成为最近使用的
      cache.get('key1');

      // 添加新项应该删除key2
      cache.set('key3', 300);

      expect(cache.get('key1')).toBe(100);
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe(300);
    });

    it('应该正确处理过期项', async () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 50, // 50ms TTL
      });

      cache.set('key1', 100);
      expect(cache.get('key1')).toBe(100);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该正确清理过期项', async () => {
      const cache = new LRUCache<string, number>({
        maxSize: 10,
        ttl: 50,
      });

      cache.set('key1', 100);
      cache.set('key2', 200);

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 60));

      cache.cleanup();
      expect(cache.size()).toBe(0);
    });
  });

  describe('useDebounce Hook', () => {
    it('应该延迟执行函数', async () => {
      const mockFn = jest.fn();
      const { result } = renderHook(() => useDebounce(mockFn, 100));

      act(() => {
        result.current('test1');
        result.current('test2');
        result.current('test3');
      });

      // 立即检查，函数不应该被调用
      expect(mockFn).not.toHaveBeenCalled();

      // 等待防抖延迟
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // 现在函数应该只被调用一次，使用最后的参数
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test3');
    });

    it('应该在新调用时重置计时器', async () => {
      const mockFn = jest.fn();
      const { result } = renderHook(() => useDebounce(mockFn, 100));

      act(() => {
        result.current('test1');
      });

      // 50ms后再次调用
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        result.current('test2');
      });

      // 再等待100ms
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // 函数应该只被调用一次，使用最后的参数
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test2');
    });
  });

  describe('useThrottle Hook', () => {
    it('应该限制函数调用频率', async () => {
      const mockFn = jest.fn();
      const { result } = renderHook(() => useThrottle(mockFn, 100));

      act(() => {
        result.current('test1');
        result.current('test2');
        result.current('test3');
      });

      // 第一次调用应该立即执行
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('test1');

      // 等待节流延迟
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // 最后一次调用应该在延迟后执行
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('test3');
    });
  });

  describe('performanceUtils', () => {
    it('应该测量函数执行时间', () => {
      // 在开发环境下测试
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = 'development';

      const consoleSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const testFn = (x: number) => x * 2;
      const measuredFn = performanceUtils.measure(testFn, 'testFunction');

      const result = measuredFn(5);

      expect(result).toBe(10);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('testFunction 执行时间:')
      );

      consoleSpy.mockRestore();
      (process.env as any).NODE_ENV = originalEnv;
    });

    it('应该检测慢设备', () => {
      // Mock navigator properties
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: true,
        value: 2,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: 1,
      });

      expect(performanceUtils.isSlowDevice()).toBe(true);

      // Test fast device
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        writable: true,
        value: 8,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        writable: true,
        value: 8,
      });

      expect(performanceUtils.isSlowDevice()).toBe(false);
    });
  });

  describe('全局缓存性能测试', () => {
    it('应该有良好的读写性能', () => {
      const startTime = performance.now();

      // 写入1000个项目
      for (let i = 0; i < 1000; i++) {
        globalCache.set(`key${i}`, { data: `value${i}` });
      }

      const writeTime = performance.now() - startTime;

      const readStartTime = performance.now();

      // 读取1000个项目
      for (let i = 0; i < 1000; i++) {
        globalCache.get(`key${i}`);
      }

      const readTime = performance.now() - readStartTime;

      // 写入和读取都应该在合理时间内完成
      expect(writeTime).toBeLessThan(100); // 100ms
      expect(readTime).toBeLessThan(50); // 50ms
    });

    it('应该正确处理缓存命中率', () => {
      const testData = Array.from({ length: 100 }, (_, i) => ({
        key: `key${i}`,
        value: `value${i}`,
      }));

      // 写入数据
      testData.forEach(({ key, value }) => {
        globalCache.set(key, value);
      });

      let hits = 0;
      let misses = 0;

      // 测试缓存命中率
      for (let i = 0; i < 200; i++) {
        const key = `key${i}`;
        const result = globalCache.get(key);

        if (result) {
          hits++;
        } else {
          misses++;
        }
      }

      // 前100个应该命中，后100个应该未命中
      expect(hits).toBe(100);
      expect(misses).toBe(100);

      const hitRate = hits / (hits + misses);
      expect(hitRate).toBe(0.5);
    });
  });

  describe('内存使用测试', () => {
    it('应该监控内存使用情况', () => {
      // Mock performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 10000000,
          totalJSHeapSize: 20000000,
          jsHeapSizeLimit: 100000000,
        },
        configurable: true,
      });

      const memoryUsage = performanceUtils.getMemoryUsage();

      expect(memoryUsage).toEqual({
        used: 10000000,
        total: 20000000,
        limit: 100000000,
      });
    });

    it('应该处理不支持memory API的情况', () => {
      // Remove memory property
      const originalMemory = (performance as any).memory;
      delete (performance as any).memory;

      const memoryUsage = performanceUtils.getMemoryUsage();
      expect(memoryUsage).toBeNull();

      // Restore memory property
      if (originalMemory) {
        (performance as any).memory = originalMemory;
      }
    });
  });

  describe('批量操作性能测试', () => {
    it('应该高效处理大量数据', () => {
      const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
      }));

      const startTime = performance.now();

      // 模拟批量处理
      const processedData = largeDataSet
        .filter(item => item.value > 0.5)
        .map(item => ({ ...item, processed: true }))
        .slice(0, 1000);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(processedData.length).toBeLessThanOrEqual(1000);
      expect(processingTime).toBeLessThan(100); // 应该在100ms内完成
    });
  });
});

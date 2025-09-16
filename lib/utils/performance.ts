/**
 * 性能优化工具
 * 提供布局系统的性能监控和优化功能
 * 严格遵循全栈项目统一约定规范
 */

import { useCallback, useEffect, useRef, useMemo, useState } from 'react';

/**
 * 性能指标类型
 */
interface PerformanceMetrics {
  renderTime: number;
  componentCount: number;
  memoryUsage: number;
  timestamp: number;
}

/**
 * 缓存配置
 */
interface CacheConfig {
  maxSize: number;
  ttl: number; // 生存时间（毫秒）
}

/**
 * 缓存项
 */
interface CacheItem<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * LRU缓存实现
 */
export class LRUCache<K, V> {
  private cache = new Map<K, CacheItem<V>>();
  private maxSize: number;
  private ttl: number;

  constructor(config: CacheConfig) {
    this.maxSize = config.maxSize;
    this.ttl = config.ttl;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);

    if (!item) return undefined;

    // 检查是否过期
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问计数
    item.accessCount++;

    // 移到最后（LRU策略）
    this.cache.delete(key);
    this.cache.set(key, item);

    return item.value;
  }

  set(key: K, value: V): void {
    // 如果已存在，更新值
    if (this.cache.has(key)) {
      const item = this.cache.get(key)!;
      item.value = value;
      item.timestamp = Date.now();
      return;
    }

    // 如果缓存已满，删除最少使用的项
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // 添加新项
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // 清理过期项
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * 防抖Hook
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
}

/**
 * 节流Hook
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= delay) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastCall);
      }
    }) as T,
    [callback, delay]
  );
}

/**
 * 内存化Hook
 */
export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

/**
 * 深度内存化Hook
 */
export function useDeepMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();

  if (!ref.current || !areEqual(ref.current.deps, deps)) {
    ref.current = {
      deps: [...deps],
      value: factory(),
    };
  }

  return ref.current.value;
}

/**
 * 深度比较函数
 */
function areEqual(a: React.DependencyList, b: React.DependencyList): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }

  return true;
}

/**
 * 性能监控Hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderStartRef = useRef<number>();
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  useEffect(() => {
    renderStartRef.current = performance.now();
  });

  useEffect(() => {
    if (renderStartRef.current) {
      const renderTime = performance.now() - renderStartRef.current;

      const metrics: PerformanceMetrics = {
        renderTime,
        componentCount: 1,
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
        timestamp: Date.now(),
      };

      metricsRef.current.push(metrics);

      // 保持最近100条记录
      if (metricsRef.current.length > 100) {
        metricsRef.current.shift();
      }

      // 在开发环境下输出性能警告
      if (process.env.NODE_ENV === 'development' && renderTime > 16) {
        console.warn(
          `${componentName} 渲染时间过长: ${renderTime.toFixed(2)}ms`
        );
      }
    }
  });

  return {
    getMetrics: () => metricsRef.current,
    getAverageRenderTime: () => {
      const metrics = metricsRef.current;
      if (metrics.length === 0) return 0;

      const total = metrics.reduce((sum, m) => sum + m.renderTime, 0);
      return total / metrics.length;
    },
  };
}

/**
 * 虚拟滚动Hook
 */
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const visibleItems = useMemo(() => items.slice(visibleRange.startIndex, visibleRange.endIndex), [items, visibleRange]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

/**
 * 图片懒加载Hook
 */
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const img = new Image();
          img.onload = () => {
            setImageSrc(src);
            setIsLoaded(true);
          };
          img.onerror = () => {
            setIsError(true);
          };
          img.src = src;
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return { imageSrc, isLoaded, isError, imgRef };
}

/**
 * 批量操作Hook
 */
export function useBatchUpdate<T>(initialItems: T[], batchSize: number = 50) {
  const [items, setItems] = useState(initialItems);
  const [isProcessing, setIsProcessing] = useState(false);
  const queueRef = useRef<Array<(items: T[]) => T[]>>([]);

  const addToBatch = useCallback(
    (operation: (items: T[]) => T[]) => {
      queueRef.current.push(operation);

      if (!isProcessing) {
        setIsProcessing(true);

        // 使用 requestIdleCallback 或 setTimeout 进行批量处理
        const processBatch = () => {
          const operations = queueRef.current.splice(0, batchSize);

          if (operations.length > 0) {
            setItems(currentItems => operations.reduce((acc, op) => op(acc), currentItems));

            if (queueRef.current.length > 0) {
              setTimeout(processBatch, 0);
            } else {
              setIsProcessing(false);
            }
          } else {
            setIsProcessing(false);
          }
        };

        setTimeout(processBatch, 0);
      }
    },
    [batchSize, isProcessing]
  );

  return { items, addToBatch, isProcessing };
}

/**
 * 全局缓存实例
 */
export const globalCache = new LRUCache<string, any>({
  maxSize: 1000,
  ttl: 5 * 60 * 1000, // 5分钟
});

/**
 * 性能工具函数
 */
export const performanceUtils = {
  /**
   * 测量函数执行时间
   */
  measure: <T extends (...args: any[]) => any>(fn: T, name?: string): T => ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();

      if (name && process.env.NODE_ENV === 'development') {
        console.log(`${name} 执行时间: ${(end - start).toFixed(2)}ms`);
      }

      return result;
    }) as T,

  /**
   * 获取内存使用情况
   */
  getMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
      };
    }
    return null;
  },

  /**
   * 检查是否为慢设备
   */
  isSlowDevice: () => {
    // 基于硬件并发数和内存判断
    const cores = navigator.hardwareConcurrency || 1;
    const memory = (navigator as any).deviceMemory || 1;

    return cores <= 2 || memory <= 2;
  },
};

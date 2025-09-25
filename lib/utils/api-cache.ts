/**
 * API缓存和请求去重工具
 * 提供智能缓存策略和请求去重机制
 */

interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface RequestEntry<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
}

/**
 * API缓存管理器
 */
class ApiCacheManager {
  private cache = new Map<string, CacheEntry<unknown>>();
  private pendingRequests = new Map<string, RequestEntry<unknown>>();
  private defaultTTL = 5 * 60 * 1000; // 5分钟默认缓存时间

  /**
   * 生成缓存键
   */
  private generateKey(url: string, options?: RequestInit): string {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.stringify(options.body) : '';
    return `${method}:${url}:${body}`;
  }

  /**
   * 检查缓存是否有效
   */
  private isValidCache(entry: CacheEntry<unknown>): boolean {
    return Date.now() < entry.expiresAt;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 清理过期请求
   */
  private cleanExpiredRequests(): void {
    const now = Date.now();
    const maxAge = 30 * 1000; // 30秒超时

    for (const [key, entry] of this.pendingRequests.entries()) {
      if (now - entry.timestamp > maxAge) {
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * 获取缓存数据
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && this.isValidCache(entry)) {
      return entry.data as T;
    }

    if (entry) {
      this.cache.delete(key); // 删除过期缓存
    }

    return null;
  }

  /**
   * 设置缓存数据
   */
  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });

    // 定期清理过期缓存
    if (this.cache.size % 50 === 0) {
      this.cleanExpiredCache();
    }
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  /**
   * 带缓存的fetch请求
   */
  async fetch<T>(
    url: string,
    options: RequestInit & { ttl?: number } = {}
  ): Promise<T> {
    const { ttl = this.defaultTTL, ...fetchOptions } = options;
    const cacheKey = this.generateKey(url, fetchOptions);

    // 检查缓存
    const cachedData = this.get<T>(cacheKey);
    if (cachedData !== null) {
      return cachedData;
    }

    // 检查是否有正在进行的相同请求（请求去重）
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest.promise;
    }

    // 发起新请求
    const requestPromise = this.performFetch<T>(url, fetchOptions);

    // 记录正在进行的请求
    this.pendingRequests.set(cacheKey, {
      promise: requestPromise as Promise<unknown>,
      timestamp: Date.now(),
    });

    try {
      const result = await requestPromise;

      // 缓存结果
      this.set(cacheKey, result, ttl);

      return result;
    } finally {
      // 清理请求记录
      this.pendingRequests.delete(cacheKey);

      // 定期清理过期请求
      if (this.pendingRequests.size % 10 === 0) {
        this.cleanExpiredRequests();
      }
    }
  }

  /**
   * 执行实际的fetch请求
   */
  private async performFetch<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * 使缓存无效
   */
  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.clear();
      return;
    }

    const keys = Array.from(this.cache.keys());

    if (typeof pattern === 'string') {
      // 字符串匹配
      keys.forEach(key => {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      });
    } else {
      // 正则表达式匹配
      keys.forEach(key => {
        if (pattern.test(key)) {
          this.cache.delete(key);
        }
      });
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isValidCache(entry)) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      pendingRequests: this.pendingRequests.size,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * 估算内存使用量（字节）
   */
  private estimateMemoryUsage(): number {
    let size = 0;

    for (const [key, entry] of this.cache.entries()) {
      size += key.length * 2; // 字符串按UTF-16计算
      size += JSON.stringify(entry.data).length * 2;
      size += 16; // timestamp和expiresAt
    }

    return size;
  }
}

// 全局缓存实例
export const apiCache = new ApiCacheManager();

/**
 * 带缓存的API请求工具函数
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit & { ttl?: number } = {}
): Promise<T> {
  return apiCache.fetch<T>(url, options);
}

/**
 * 库存相关的缓存工具
 */
export const inventoryCache = {
  /**
   * 获取库存列表（带缓存）
   */
  async getList(params: Record<string, unknown> = {}, ttl = 5 * 60 * 1000) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });

    const url = `/api/inventory?${searchParams.toString()}`;
    return cachedFetch(url, { ttl });
  },

  /**
   * 获取库存详情（带缓存）
   */
  async getDetail(id: string, ttl = 2 * 60 * 1000) {
    return cachedFetch(`/api/inventory/${id}`, { ttl });
  },

  /**
   * 获取库存统计（带缓存）
   */
  async getStats(ttl = 5 * 60 * 1000) {
    return cachedFetch('/api/inventory/stats', { ttl });
  },

  /**
   * 获取库存预警（带缓存）
   */
  async getAlerts(ttl = 2 * 60 * 1000) {
    return cachedFetch('/api/inventory/alerts', { ttl });
  },

  /**
   * 使库存相关缓存无效
   */
  invalidate() {
    apiCache.invalidate(/\/api\/inventory/);
  },

  /**
   * 清空库存缓存
   */
  clear() {
    apiCache.invalidate(/\/api\/inventory/);
  },
};

/**
 * 请求去重装饰器
 */
export function withDeduplication<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, keyGenerator?: (...args: Parameters<T>) => string): T {
  const pendingRequests = new Map<string, Promise<unknown>>();

  return (async (...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    // 如果有相同的请求正在进行，返回相同的Promise
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }

    // 执行新请求
    const promise = fn(...args);
    pendingRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // 清理请求记录
      pendingRequests.delete(key);
    }
  }) as T;
}

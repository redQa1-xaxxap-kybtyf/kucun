/**
 * 速率限制功能测试脚本（独立版本）
 * 不依赖环境变量，直接测试核心功能
 */

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✓ ${message}`, colors.green);
}

function logError(message: string) {
  log(`✗ ${message}`, colors.red);
}

function logInfo(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

// 工具函数：延迟
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 内存缓存条目接口
 */
interface MemoryCacheEntry {
  requests: number[];
  expiry: number;
}

/**
 * 简化的内存存储实现
 */
class SimpleMemoryStorage {
  private cache = new Map<string, MemoryCacheEntry>();

  async getRequestsInWindow(
    key: string,
    windowStart: number,
    windowEnd: number
  ): Promise<number[]> {
    const entry = this.cache.get(key);
    if (!entry) return [];

    if (entry.expiry > 0 && entry.expiry < Date.now()) {
      this.cache.delete(key);
      return [];
    }

    return entry.requests.filter(
      timestamp => timestamp >= windowStart && timestamp <= windowEnd
    );
  }

  async addRequest(key: string, timestamp: number, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    const expiry = Date.now() + ttl;

    if (entry) {
      entry.requests.push(timestamp);
      entry.expiry = expiry;
    } else {
      this.cache.set(key, { requests: [timestamp], expiry });
    }
  }

  async cleanup(key: string, before: number): Promise<void> {
    const entry = this.cache.get(key);
    if (!entry) return;

    const validRequests = entry.requests.filter(timestamp => timestamp >= before);
    if (validRequests.length === 0) {
      this.cache.delete(key);
    } else {
      entry.requests = validRequests;
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

/**
 * 速率限制结果
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  current: number;
  limit: number;
}

/**
 * 简化的速率限制器实现
 */
class SimpleRateLimiter {
  constructor(
    private storage: SimpleMemoryStorage,
    private config: RateLimitConfig
  ) {}

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = `${this.config.keyPrefix}:${identifier}`;

    await this.storage.cleanup(key, windowStart);

    const requests = await this.storage.getRequestsInWindow(key, windowStart, now);
    const currentCount = requests.length;
    const allowed = currentCount < this.config.maxRequests;

    if (allowed) {
      await this.storage.addRequest(key, now, this.config.windowMs);
    }

    const remaining = Math.max(
      0,
      this.config.maxRequests - currentCount - (allowed ? 1 : 0)
    );

    return {
      allowed,
      remaining,
      resetAt: new Date(now + this.config.windowMs),
      current: currentCount,
      limit: this.config.maxRequests,
    };
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    await this.storage.cleanup(key, now + this.config.windowMs);
  }

  async getStatus(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = `${this.config.keyPrefix}:${identifier}`;

    const requests = await this.storage.getRequestsInWindow(key, windowStart, now);
    const currentCount = requests.length;
    const allowed = currentCount < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - currentCount);

    return {
      allowed,
      remaining,
      resetAt: new Date(now + this.config.windowMs),
      current: currentCount,
      limit: this.config.maxRequests,
    };
  }
}

/**
 * 测试1: 基本速率限制功能
 */
async function testBasicRateLimit() {
  log('\n=== 测试1: 基本速率限制功能 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60000,
    keyPrefix: 'test:login',
  };
  const limiter = new SimpleRateLimiter(storage, config);

  logInfo(`配置: ${config.maxRequests} 请求 / ${config.windowMs / 1000} 秒`);

  const identifier = 'test-user-1';

  // 发送允许的请求
  for (let i = 1; i <= config.maxRequests; i++) {
    const result = await limiter.checkLimit(identifier);
    if (result.allowed) {
      logSuccess(`请求 ${i}/${config.maxRequests} - 允许 (剩余: ${result.remaining})`);
    } else {
      logError(`请求 ${i}/${config.maxRequests} - 应该允许但被拒绝`);
      return false;
    }
  }

  // 发送超出限制的请求
  const overLimitResult = await limiter.checkLimit(identifier);
  if (!overLimitResult.allowed) {
    logSuccess(`请求 ${config.maxRequests + 1} - 正确拒绝（已达限制）`);
  } else {
    logError(`请求 ${config.maxRequests + 1} - 应该拒绝但被允许`);
    return false;
  }

  logSuccess('基本速率限制测试通过');
  return true;
}

/**
 * 测试2: 不同标识符独立计数
 */
async function testMultipleIdentifiers() {
  log('\n=== 测试2: 不同标识符独立计数 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 5,
    windowMs: 60000,
    keyPrefix: 'test:auth',
  };
  const limiter = new SimpleRateLimiter(storage, config);

  const user1 = 'user:alice';
  const user2 = 'user:bob';
  const ip1 = 'ip:192.168.1.1';

  // 用户1发送请求
  for (let i = 0; i < config.maxRequests; i++) {
    await limiter.checkLimit(user1);
  }

  // 用户2应该仍然可以发送请求
  const user2Result = await limiter.checkLimit(user2);
  if (user2Result.allowed) {
    logSuccess('用户2的请求正确允许（独立于用户1）');
  } else {
    logError('用户2的请求被错误拒绝');
    return false;
  }

  // IP地址也应该独立
  const ipResult = await limiter.checkLimit(ip1);
  if (ipResult.allowed) {
    logSuccess('IP地址的请求正确允许（独立于用户）');
  } else {
    logError('IP地址的请求被错误拒绝');
    return false;
  }

  logSuccess('多标识符独立性测试通过');
  return true;
}

/**
 * 测试3: 滑动窗口算法
 */
async function testSlidingWindow() {
  log('\n=== 测试3: 滑动窗口算法 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 3,
    windowMs: 2000, // 2秒
    keyPrefix: 'test:sliding',
  };
  const limiter = new SimpleRateLimiter(storage, config);
  const identifier = 'test-sliding-window';

  logInfo('发送3个请求（达到限制）');
  for (let i = 1; i <= 3; i++) {
    const result = await limiter.checkLimit(identifier);
    if (result.allowed) {
      logSuccess(`请求 ${i} - 允许`);
    } else {
      logError(`请求 ${i} - 应该允许但被拒绝`);
      return false;
    }
  }

  // 第4个请求应该被拒绝
  const blockedResult = await limiter.checkLimit(identifier);
  if (!blockedResult.allowed) {
    logSuccess('请求4 - 正确拒绝');
  } else {
    logError('请求4 - 应该拒绝但被允许');
    return false;
  }

  // 等待窗口过期
  logInfo('等待2.5秒让窗口过期...');
  await delay(2500);

  // 窗口过期后应该可以再次请求
  const afterWindowResult = await limiter.checkLimit(identifier);
  if (afterWindowResult.allowed) {
    logSuccess('窗口过期后的请求 - 正确允许');
  } else {
    logError('窗口过期后的请求 - 应该允许但被拒绝');
    return false;
  }

  logSuccess('滑动窗口算法测试通过');
  return true;
}

/**
 * 测试4: 重置功能
 */
async function testReset() {
  log('\n=== 测试4: 重置功能 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 30,
    windowMs: 60000,
    keyPrefix: 'test:write',
  };
  const limiter = new SimpleRateLimiter(storage, config);
  const identifier = 'test-reset';

  // 发送请求直到达到限制
  for (let i = 0; i < config.maxRequests; i++) {
    await limiter.checkLimit(identifier);
  }

  // 验证已达限制
  const blockedResult = await limiter.checkLimit(identifier);
  if (!blockedResult.allowed) {
    logSuccess('已达速率限制');
  } else {
    logError('应该达到限制但未达到');
    return false;
  }

  // 重置限制
  await limiter.reset(identifier);
  logInfo('已重置速率限制');

  // 重置后应该可以再次请求
  const afterResetResult = await limiter.checkLimit(identifier);
  if (afterResetResult.allowed) {
    logSuccess('重置后的请求 - 正确允许');
  } else {
    logError('重置后的请求 - 应该允许但被拒绝');
    return false;
  }

  logSuccess('重置功能测试通过');
  return true;
}

/**
 * 测试5: 获取状态（不记录请求）
 */
async function testGetStatus() {
  log('\n=== 测试5: 获取状态功能 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 60,
    windowMs: 60000,
    keyPrefix: 'test:read',
  };
  const limiter = new SimpleRateLimiter(storage, config);
  const identifier = 'test-status';

  // 发送3个实际请求
  for (let i = 0; i < 3; i++) {
    await limiter.checkLimit(identifier);
  }

  // 获取状态（不应该增加计数）
  const status1 = await limiter.getStatus(identifier);
  const status2 = await limiter.getStatus(identifier);

  if (status1.current === 3 && status2.current === 3) {
    logSuccess(`状态查询正确 - 当前: ${status1.current}, 剩余: ${status1.remaining}`);
  } else {
    logError(`状态查询不正确 - 期望3，得到: ${status1.current}, ${status2.current}`);
    return false;
  }

  logSuccess('获取状态功能测试通过');
  return true;
}

/**
 * 测试6: 内存存储统计
 */
async function testMemoryStorageStats() {
  log('\n=== 测试6: 内存存储统计 ===', colors.magenta);

  const storage = new SimpleMemoryStorage();
  const config: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000,
    keyPrefix: 'test:global',
  };
  const limiter = new SimpleRateLimiter(storage, config);

  // 为多个标识符创建请求
  await limiter.checkLimit('user:alice');
  await limiter.checkLimit('user:bob');
  await limiter.checkLimit('ip:192.168.1.1');

  const stats = storage.getStats();
  logInfo(`内存存储统计: 键数量=${stats.size}`);
  logInfo(`存储的键: ${stats.keys.join(', ')}`);

  if (stats.size >= 3) {
    logSuccess('内存存储统计正确');
  } else {
    logError('内存存储统计不正确');
    return false;
  }

  logSuccess('内存存储统计测试通过');
  return true;
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  log('\n╔════════════════════════════════════════════╗', colors.blue);
  log('║   速率限制功能测试套件                     ║', colors.blue);
  log('╚════════════════════════════════════════════╝\n', colors.blue);

  const tests = [
    { name: '基本速率限制功能', fn: testBasicRateLimit },
    { name: '多标识符独立性', fn: testMultipleIdentifiers },
    { name: '滑动窗口算法', fn: testSlidingWindow },
    { name: '重置功能', fn: testReset },
    { name: '获取状态功能', fn: testGetStatus },
    { name: '内存存储统计', fn: testMemoryStorageStats },
  ];

  const results = [];

  for (const test of tests) {
    try {
      const passed = await test.fn();
      results.push({ name: test.name, passed });
    } catch (error) {
      logError(`测试 "${test.name}" 抛出异常: ${error}`);
      results.push({ name: test.name, passed: false });
    }
  }

  // 打印测试总结
  log('\n╔════════════════════════════════════════════╗', colors.blue);
  log('║   测试总结                                 ║', colors.blue);
  log('╚════════════════════════════════════════════╝\n', colors.blue);

  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  results.forEach(result => {
    const status = result.passed ? '✓' : '✗';
    const color = result.passed ? colors.green : colors.red;
    log(`${status} ${result.name}`, color);
  });

  log('');
  if (passed === total) {
    logSuccess(`所有测试通过 (${passed}/${total})`);
    process.exit(0);
  } else {
    logError(`部分测试失败 (${passed}/${total} 通过)`);
    process.exit(1);
  }
}

// 运行测试
runAllTests().catch(error => {
  logError(`测试运行失败: ${error}`);
  process.exit(1);
});

/**
 * 登录日志服务
 * 记录所有登录尝试,用于安全审计和异常检测
 * 遵循全栈项目统一约定规范
 */

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';

// 登录日志类型
export type LoginLogType = 'success' | 'failed' | 'blocked';

// 登录失败原因
export type LoginFailureReason =
  | 'invalid_credentials' // 用户名或密码错误
  | 'account_disabled' // 账户被禁用
  | 'captcha_incorrect' // 验证码错误
  | 'captcha_expired' // 验证码过期
  | 'too_many_attempts' // 尝试次数过多
  | 'ip_blocked' // IP 被封禁
  | 'other'; // 其他原因

// 登录日志接口
export interface LoginLog {
  userId?: string;
  username: string;
  type: LoginLogType;
  failureReason?: LoginFailureReason;
  clientIp: string;
  userAgent?: string;
  timestamp: Date;
}

// 登录失败限制配置
const LOGIN_LIMIT_CONFIG = {
  maxAttempts: 5, // 最大失败次数
  blockDuration: 15 * 60, // 封禁时长(秒): 15分钟
  redisKeyPrefix: 'login:attempts:', // Redis 键前缀
} as const;

/**
 * 记录登录日志到数据库
 */
export async function createLoginLog(log: LoginLog): Promise<void> {
  try {
    // 这里应该创建一个 LoginLog 表来存储日志
    // 由于当前数据库模型中没有这个表,我们先记录到控制台
    // 后续可以通过 Prisma 迁移添加这个表

    logger.info('login-log-service', '记录登录日志', {
      type: log.type,
      username: log.username,
      userId: log.userId,
      failureReason: log.failureReason,
      clientIp: log.clientIp,
      userAgent: log.userAgent,
      timestamp: log.timestamp.toISOString(),
    });

    // TODO: 添加到数据库
    // await prisma.loginLog.create({
    //   data: {
    //     userId: log.userId,
    //     username: log.username,
    //     type: log.type,
    //     failureReason: log.failureReason,
    //     clientIp: log.clientIp,
    //     userAgent: log.userAgent,
    //     timestamp: log.timestamp,
    //   },
    // });
  } catch (error) {
    logger.error('login-log-service', '记录登录日志失败', error);
  }
}

/**
 * 获取登录失败次数
 */
export async function getLoginAttempts(
  identifier: string // 可以是用户名或 IP
): Promise<number> {
  const redisKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${identifier}`;
  const client = redis.getClient();
  const attempts = await client.get(redisKey);
  return attempts ? parseInt(attempts, 10) : 0;
}

/**
 * 增加登录失败次数
 */
export async function incrementLoginAttempts(
  identifier: string
): Promise<number> {
  const redisKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${identifier}`;
  const client = redis.getClient();
  const attempts = await client.incr(redisKey);

  // 设置过期时间(如果是第一次失败)
  if (attempts === 1) {
    await client.expire(redisKey, LOGIN_LIMIT_CONFIG.blockDuration);
  }

  return attempts;
}

/**
 * 重置登录失败次数
 */
export async function resetLoginAttempts(identifier: string): Promise<void> {
  const redisKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${identifier}`;
  await redis.del(redisKey);
}

/**
 * 检查是否被封禁
 */
export async function isLoginBlocked(identifier: string): Promise<boolean> {
  const attempts = await getLoginAttempts(identifier);
  return attempts >= LOGIN_LIMIT_CONFIG.maxAttempts;
}

/**
 * 获取剩余封禁时间(秒)
 */
export async function getBlockRemainingTime(
  identifier: string
): Promise<number> {
  const redisKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${identifier}`;
  const client = redis.getClient();
  const ttl = await client.ttl(redisKey);
  return ttl > 0 ? ttl : 0;
}

/**
 * 记录登录成功（优化版本 - 使用 Pipeline 批量删除）
 */
export async function logLoginSuccess(
  userId: string,
  username: string,
  clientIp: string,
  userAgent?: string
): Promise<void> {
  // 记录日志
  await createLoginLog({
    userId,
    username,
    type: 'success',
    clientIp,
    userAgent,
    timestamp: new Date(),
  });

  // 🚀 性能优化：使用 Pipeline 批量删除失败次数记录
  const client = redis.getClient();
  const usernameKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${username}`;
  const ipKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${clientIp}`;

  const pipeline = client.pipeline();
  pipeline.del(usernameKey);
  pipeline.del(ipKey);
  await pipeline.exec();
}

/**
 * 记录登录失败（优化版本 - 使用 Pipeline 批量增加失败次数）
 */
export async function logLoginFailure(
  username: string,
  clientIp: string,
  failureReason: LoginFailureReason,
  userAgent?: string
): Promise<void> {
  // 记录日志
  await createLoginLog({
    username,
    type: 'failed',
    failureReason,
    clientIp,
    userAgent,
    timestamp: new Date(),
  });

  // 🚀 性能优化：使用 Pipeline 批量增加失败次数
  const client = redis.getClient();
  const usernameKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${username}`;
  const ipKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${clientIp}`;

  const pipeline = client.pipeline();
  pipeline.incr(usernameKey);
  pipeline.expire(usernameKey, LOGIN_LIMIT_CONFIG.blockDuration);
  pipeline.incr(ipKey);
  pipeline.expire(ipKey, LOGIN_LIMIT_CONFIG.blockDuration);

  await pipeline.exec();
}

/**
 * 记录登录被阻止
 */
export async function logLoginBlocked(
  username: string,
  clientIp: string,
  userAgent?: string
): Promise<void> {
  // 记录日志
  await createLoginLog({
    username,
    type: 'blocked',
    failureReason: 'too_many_attempts',
    clientIp,
    userAgent,
    timestamp: new Date(),
  });
}

/**
 * 检查登录是否被限制（优化版本 - 使用 Pipeline 批量操作）
 * 返回 { allowed: boolean, reason?: string, remainingTime?: number }
 */
export async function checkLoginLimit(
  username: string,
  clientIp: string
): Promise<{
  allowed: boolean;
  reason?: string;
  remainingTime?: number;
}> {
  const client = redis.getClient();

  // 🚀 性能优化：使用 Pipeline 批量获取
  const usernameKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${username}`;
  const ipKey = `${LOGIN_LIMIT_CONFIG.redisKeyPrefix}${clientIp}`;

  const pipeline = client.pipeline();
  pipeline.get(usernameKey);
  pipeline.get(ipKey);
  pipeline.ttl(usernameKey);
  pipeline.ttl(ipKey);

  const results = await pipeline.exec();

  // 解析结果
  const usernameAttempts = parseInt((results?.[0]?.[1] as string) || '0', 10);
  const ipAttempts = parseInt((results?.[1]?.[1] as string) || '0', 10);
  const usernameTTL = (results?.[2]?.[1] as number) || 0;
  const ipTTL = (results?.[3]?.[1] as number) || 0;

  // 检查用户名是否被封禁
  if (usernameAttempts >= LOGIN_LIMIT_CONFIG.maxAttempts) {
    const remainingTime = usernameTTL > 0 ? usernameTTL : 0;
    return {
      allowed: false,
      reason: `该账户登录失败次数过多,请在 ${Math.ceil(remainingTime / 60)} 分钟后重试`,
      remainingTime,
    };
  }

  // 检查 IP 是否被封禁
  if (ipAttempts >= LOGIN_LIMIT_CONFIG.maxAttempts) {
    const remainingTime = ipTTL > 0 ? ipTTL : 0;
    return {
      allowed: false,
      reason: `该 IP 登录失败次数过多,请在 ${Math.ceil(remainingTime / 60)} 分钟后重试`,
      remainingTime,
    };
  }

  return { allowed: true };
}

/**
 * 获取用户最近的登录记录
 */
export async function getRecentLoginLogs(
  username: string,
  limit = 10
): Promise<LoginLog[]> {
  // TODO: 从数据库查询
  // return await prisma.loginLog.findMany({
  //   where: { username },
  //   orderBy: { timestamp: 'desc' },
  //   take: limit,
  // });

  logger.info('login-log-service', '查询最近登录记录', {
    username,
    limit,
  });
  return [];
}

/**
 * 获取异常登录检测
 * 检测异地登录、频繁登录等异常行为
 */
export async function detectAnomalousLogin(
  username: string,
  clientIp: string
): Promise<{
  isAnomalous: boolean;
  reason?: string;
}> {
  // TODO: 实现异常检测逻辑
  // 1. 检查是否异地登录(IP 地理位置变化)
  // 2. 检查登录频率是否异常
  // 3. 检查是否在黑名单 IP 中
  // 4. 检查设备指纹是否变化

  logger.info('login-log-service', '执行登录异常检测', {
    username,
    clientIp,
  });

  return {
    isAnomalous: false,
  };
}

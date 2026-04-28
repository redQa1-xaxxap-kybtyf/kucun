import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/redis-client';

const DEFAULT_MAX_CONCURRENT_SESSIONS = 3;
const ADMIN_MAX_CONCURRENT_SESSIONS = 1;
const DEFAULT_IDLE_TIMEOUT_SECONDS = 2 * 60 * 60;

type SessionRecord = {
  userId: string;
  sessionId: string;
  createdAtMs: number;
  lastActiveAtMs: number;
  expiresAtMs: number;
};

const getSessionKey = (sessionId: string) => `auth:session:${sessionId}`;
const getUserSessionsKey = (userId: string) => `auth:user-sessions:${userId}`;

export function getMaxConcurrentSessionsForRole(role?: string | null): number {
  const normalizedRole = role?.trim().toLowerCase();
  return normalizedRole === 'admin'
    ? ADMIN_MAX_CONCURRENT_SESSIONS
    : DEFAULT_MAX_CONCURRENT_SESSIONS;
}

function safeParseSession(raw: string): SessionRecord | null {
  try {
    const parsed = JSON.parse(raw) as SessionRecord;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (
      typeof parsed.userId !== 'string' ||
      typeof parsed.sessionId !== 'string' ||
      typeof parsed.createdAtMs !== 'number' ||
      typeof parsed.lastActiveAtMs !== 'number' ||
      typeof parsed.expiresAtMs !== 'number'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function cleanupSession(params: {
  userId: string;
  sessionId: string;
}): Promise<void> {
  try {
    const client = redis.getClient();
    await client
      .multi()
      .del(getSessionKey(params.sessionId))
      .zrem(getUserSessionsKey(params.userId), params.sessionId)
      .exec();
  } catch (error) {
    logger.warn(
      'user-session',
      '清理会话记录失败(忽略)',
      { userId: params.userId, sessionId: params.sessionId },
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }
}

async function enforceMaxSessions(params: {
  userId: string;
  maxSessions: number;
}): Promise<void> {
  if (params.maxSessions <= 0) {
    return;
  }

  const client = redis.getClient();

  const key = getUserSessionsKey(params.userId);
  const count = await client.zcard(key);

  if (count <= params.maxSessions) {
    return;
  }

  const excess = count - params.maxSessions;
  const evictIds = await client.zrange(key, 0, excess - 1);

  if (!evictIds || evictIds.length === 0) {
    return;
  }

  const pipeline = client.multi();

  for (const sessionId of evictIds) {
    pipeline.zrem(key, sessionId);
    pipeline.del(getSessionKey(sessionId));
  }

  await pipeline.exec();

  logger.info('user-session', '超出并发会话上限，已清理旧会话', {
    userId: params.userId,
    maxSessions: params.maxSessions,
    evictedSessionCount: evictIds.length,
  });
}

export async function registerUserSession(params: {
  userId: string;
  sessionId: string;
  expiresAtMs: number;
  maxSessions?: number;
}): Promise<void> {
  const now = Date.now();

  if (!params.sessionId || !params.userId) {
    return;
  }

  const ttlSeconds = Math.max(1, Math.ceil((params.expiresAtMs - now) / 1000));

  const record: SessionRecord = {
    userId: params.userId,
    sessionId: params.sessionId,
    createdAtMs: now,
    lastActiveAtMs: now,
    expiresAtMs: params.expiresAtMs,
  };

  const client = redis.getClient();
  await client
    .multi()
    .set(
      getSessionKey(params.sessionId),
      JSON.stringify(record),
      'EX',
      ttlSeconds
    )
    .zadd(getUserSessionsKey(params.userId), now, params.sessionId)
    .expire(getUserSessionsKey(params.userId), ttlSeconds)
    .exec();

  await enforceMaxSessions({
    userId: params.userId,
    maxSessions: params.maxSessions ?? DEFAULT_MAX_CONCURRENT_SESSIONS,
  });
}

export async function validateAndTouchUserSession(params: {
  userId: string;
  sessionId: string;
  idleTimeoutSeconds?: number;
}): Promise<{ valid: boolean; reason?: string }> {
  const sessionId = params.sessionId.trim();
  if (!sessionId) {
    return { valid: true };
  }

  const client = redis.getClient();
  const raw = await client.get(getSessionKey(sessionId));

  if (!raw) {
    return {
      valid: false,
      reason: '会话已失效，请重新登录',
    };
  }

  const record = safeParseSession(raw);
  if (!record) {
    await cleanupSession({ userId: params.userId, sessionId });
    return {
      valid: false,
      reason: '会话数据损坏，请重新登录',
    };
  }

  if (record.userId !== params.userId) {
    await cleanupSession({ userId: params.userId, sessionId });
    return {
      valid: false,
      reason: '会话校验失败，请重新登录',
    };
  }

  const now = Date.now();

  if (now >= record.expiresAtMs) {
    await cleanupSession({ userId: params.userId, sessionId });
    return {
      valid: false,
      reason: '会话已过期，请重新登录',
    };
  }

  const idleTimeoutSeconds =
    params.idleTimeoutSeconds ?? DEFAULT_IDLE_TIMEOUT_SECONDS;

  if (idleTimeoutSeconds > 0) {
    const idleMs = idleTimeoutSeconds * 1000;
    if (now - record.lastActiveAtMs > idleMs) {
      await cleanupSession({ userId: params.userId, sessionId });
      return {
        valid: false,
        reason: '会话空闲超时，请重新登录',
      };
    }
  }

  record.lastActiveAtMs = now;

  const remainingTtl = Math.max(
    1,
    Math.ceil((record.expiresAtMs - now) / 1000)
  );

  try {
    await client
      .multi()
      .set(getSessionKey(sessionId), JSON.stringify(record), 'EX', remainingTtl)
      .zadd(getUserSessionsKey(params.userId), now, sessionId)
      .expire(getUserSessionsKey(params.userId), remainingTtl)
      .exec();
  } catch (error) {
    logger.warn(
      'user-session',
      '更新会话活跃时间失败(忽略)',
      { userId: params.userId, sessionId },
      {
        error: error instanceof Error ? error.message : String(error),
      }
    );
  }

  return { valid: true };
}

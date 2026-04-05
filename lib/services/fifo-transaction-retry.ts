import { ApiError } from '@/lib/api/errors';
import { logger } from '@/lib/logger';

type RetryablePrismaErrorLike = {
  code?: unknown;
  message?: unknown;
};

type RunWithFifoTransactionRetryOptions<T> = {
  actionLabel: string;
  operation: () => Promise<T>;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  moduleName?: string;
};

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 80;
const DEFAULT_MAX_DELAY_MS = 320;
const FIFO_WRITE_CONFLICT_PATTERN = /(write conflict|deadlock)/i;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function isRetryableFifoTransactionConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as RetryablePrismaErrorLike;
  const code =
    typeof maybeError.code === 'string' ? maybeError.code : undefined;
  const message =
    typeof maybeError.message === 'string' ? maybeError.message : '';

  return code === 'P2034' || FIFO_WRITE_CONFLICT_PATTERN.test(message);
}

export function buildFifoConflictUserMessage(actionLabel: string): string {
  return `${actionLabel}失败：当前库存正在被其他单据同时处理，请稍后重试。系统未重复扣减库存，请刷新页面确认最新结果。`;
}

export async function runWithFifoTransactionRetry<T>({
  actionLabel,
  operation,
  maxRetries = DEFAULT_MAX_RETRIES,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  moduleName = 'fifo-transaction-retry',
}: RunWithFifoTransactionRetryOptions<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableFifoTransactionConflict(error)) {
        throw error;
      }

      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      const errorCode =
        typeof (error as RetryablePrismaErrorLike).code === 'string'
          ? ((error as RetryablePrismaErrorLike).code as string)
          : undefined;

      logger.warn(moduleName, '检测到 FIFO 事务写冲突，准备重试', {
        actionLabel,
        attempt,
        maxRetries,
        delayMs,
        errorCode,
      });

      await sleep(delayMs);
    }
  }

  logger.error(moduleName, 'FIFO 事务写冲突重试耗尽', lastError, {
    actionLabel,
    maxRetries,
  });

  throw ApiError.badRequest(buildFifoConflictUserMessage(actionLabel), {
    retryable: true,
  });
}

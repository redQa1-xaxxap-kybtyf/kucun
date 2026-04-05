import {
  buildFifoConflictUserMessage,
  isRetryableFifoTransactionConflict,
  runWithFifoTransactionRetry,
} from '@/lib/services/fifo-transaction-retry';

jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

function createRetryableWriteConflictError(overrides?: {
  code?: string;
  message?: string;
}) {
  return {
    code: overrides?.code ?? 'P2034',
    message:
      overrides?.message ??
      'Transaction failed due to a write conflict or a deadlock. Please retry your transaction',
  };
}

describe('fifo-transaction-retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('能识别 Prisma P2034 写冲突错误', () => {
    expect(
      isRetryableFifoTransactionConflict(createRetryableWriteConflictError())
    ).toBe(true);
  });

  it('能识别仅包含 deadlock 文案的错误', () => {
    expect(
      isRetryableFifoTransactionConflict({
        message:
          'Deadlock found when trying to get lock; try restarting transaction',
      })
    ).toBe(true);
  });

  it('遇到瞬时写冲突时会自动重试并成功', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValueOnce(createRetryableWriteConflictError())
      .mockResolvedValueOnce('ok');

    await expect(
      runWithFifoTransactionRetry({
        actionLabel: '出库',
        operation,
        baseDelayMs: 1,
        maxDelayMs: 1,
      })
    ).resolves.toBe('ok');

    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('非重试错误会直接抛出', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(new Error('库存不足'));

    await expect(
      runWithFifoTransactionRetry({
        actionLabel: '出库',
        operation,
        baseDelayMs: 1,
        maxDelayMs: 1,
      })
    ).rejects.toThrow('库存不足');

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('重试耗尽后会抛出用户可读提示', async () => {
    const operation = jest
      .fn<Promise<string>, []>()
      .mockRejectedValue(createRetryableWriteConflictError());

    await expect(
      runWithFifoTransactionRetry({
        actionLabel: '库存调整',
        operation,
        maxRetries: 2,
        baseDelayMs: 1,
        maxDelayMs: 1,
      })
    ).rejects.toThrow(buildFifoConflictUserMessage('库存调整'));

    expect(operation).toHaveBeenCalledTimes(2);
  });
});

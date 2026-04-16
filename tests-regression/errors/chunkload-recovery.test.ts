import { isChunkLoadFailureMessage } from '@/components/providers/chunkload-recovery';

describe('chunkload recovery matcher', () => {
  it('能识别常见的动态 chunk 加载失败信息', () => {
    expect(isChunkLoadFailureMessage('ChunkLoadError: failed')).toBe(true);
    expect(
      isChunkLoadFailureMessage(
        'Loading chunk app/(dashboard)/sales-orders/[id]/error failed.'
      )
    ).toBe(true);
    expect(
      isChunkLoadFailureMessage(
        'Failed to fetch dynamically imported module'
      )
    ).toBe(true);
    expect(isChunkLoadFailureMessage('普通表单校验失败')).toBe(false);
  });
});

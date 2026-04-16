import { getUniformPiecesPerUnit } from '@/lib/utils/batch-pieces-per-unit';

describe('batch-pieces-per-unit utils', () => {
  it('所有有效装箱数一致时应返回该装箱数', () => {
    expect(getUniformPiecesPerUnit([8, 8, undefined, null])).toBe(8);
  });

  it('存在不同装箱数时应返回 undefined，避免错误换算成件片', () => {
    expect(getUniformPiecesPerUnit([8, 10, 8])).toBeUndefined();
  });

  it('没有有效装箱数时应返回 undefined', () => {
    expect(getUniformPiecesPerUnit([undefined, null, 0, -1])).toBeUndefined();
  });
});

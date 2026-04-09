import {
  buildOpeningBalanceSavedValuePreview,
  convertOpeningBalanceCurrentUnitEntryToPieceValues,
  parseOpeningBalanceUnitCostInput,
} from '@/lib/utils/opening-balance-correction';

describe('opening-balance-correction utility（件价修正回归）', () => {
  test('应支持把当前保存的件数/件价换算为片数/单片成本', () => {
    expect(
      convertOpeningBalanceCurrentUnitEntryToPieceValues({
        quantity: 115,
        unitCost: 96,
        piecesPerUnit: 4,
      })
    ).toEqual({
      quantity: 460,
      unitCost: 24,
    });
  });

  test('当前保存值已是片数时，不应再重复乘装箱数', () => {
    expect(
      buildOpeningBalanceSavedValuePreview(
        {
          quantity: 4277,
          unitCost: 2.5,
          piecesPerUnit: 13,
        },
        'piece'
      )
    ).toEqual({
      quantity: 4277,
      unitCost: 2.5,
    });
  });

  test('只有明确指定当前保存值其实是件数时，才执行件转片换算', () => {
    expect(
      buildOpeningBalanceSavedValuePreview(
        {
          quantity: 329,
          unitCost: 32.5,
          piecesPerUnit: 13,
        },
        'unit'
      )
    ).toEqual({
      quantity: 4277,
      unitCost: 2.5,
    });
  });

  test('单位成本输入应支持直接填写件价或片价，并统一输出单片成本', () => {
    expect(parseOpeningBalanceUnitCostInput('24', 4)).toBe(24);
    expect(parseOpeningBalanceUnitCostInput('24片价', 4)).toBe(24);
    expect(parseOpeningBalanceUnitCostInput('96元/件', 4)).toBe(24);
    expect(parseOpeningBalanceUnitCostInput('96件价', 4)).toBe(24);
  });

  test('切到按件录入后，纯数字应按件价解释；明确片价后缀仍应优先按片处理', () => {
    expect(parseOpeningBalanceUnitCostInput('96', 4, 'unit')).toBe(24);
    expect(parseOpeningBalanceUnitCostInput('24片价', 4, 'unit')).toBe(24);
    expect(parseOpeningBalanceUnitCostInput('96件价', 4, 'piece')).toBe(24);
  });

  test('按件解析单位成本时缺少装箱数必须报错', () => {
    expect(() => parseOpeningBalanceUnitCostInput('96元/件', 0)).toThrow(
      '按件录入的单位成本需要先维护每件片数后才能换算'
    );
  });
});

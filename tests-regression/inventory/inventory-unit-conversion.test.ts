import {
  InventoryUnitConversionError,
  convertQuantityToPieces,
  convertUnitPriceToPieceCost,
  isPieceEntryUnit,
  normalizeInventoryUnit,
  toPieceOrSheetLabel,
} from '@/lib/utils/inventory-unit-conversion';

describe('inventory-unit-conversion（件/片换算回归）', () => {
  test('应正确识别按件录入单位并输出中文标签', () => {
    expect(normalizeInventoryUnit('piece')).toBe('piece');
    expect(normalizeInventoryUnit('件')).toBe('piece');
    expect(normalizeInventoryUnit('sheet')).toBe('sheet');
    expect(isPieceEntryUnit('units')).toBe(true);
    expect(isPieceEntryUnit('sheet')).toBe(false);
    expect(toPieceOrSheetLabel('piece')).toBe('件');
    expect(toPieceOrSheetLabel('sheet')).toBe('片');
  });

  test('按件录入时应把数量换算为片数，并把件价换算为单片成本', () => {
    expect(
      convertQuantityToPieces({
        quantity: 115,
        unit: 'piece',
        piecesPerUnit: 4,
      })
    ).toBe(460);

    expect(
      convertUnitPriceToPieceCost({
        unitPrice: 96,
        unit: 'piece',
        piecesPerUnit: 4,
      })
    ).toBe(24);
  });

  test('按片录入时数量和成本应保持原值', () => {
    expect(
      convertQuantityToPieces({
        quantity: 120,
        unit: 'sheet',
        piecesPerUnit: 4,
      })
    ).toBe(120);

    expect(
      convertUnitPriceToPieceCost({
        unitPrice: 12.3456,
        unit: 'sheet',
        piecesPerUnit: 4,
      })
    ).toBe(12.346);
  });

  test('按件录入缺少装箱数时，strict 模式必须报错', () => {
    expect(() =>
      convertQuantityToPieces(
        {
          quantity: 10,
          unit: 'piece',
          piecesPerUnit: undefined,
          displayName: '测试砖',
        },
        { strict: true }
      )
    ).toThrow(InventoryUnitConversionError);

    expect(() =>
      convertUnitPriceToPieceCost(
        {
          unitPrice: 80,
          unit: 'piece',
          piecesPerUnit: undefined,
          productCode: 'P-001',
        },
        { strict: true }
      )
    ).toThrow('按件录入时必须维护“每件片数”后才能继续');
  });
});

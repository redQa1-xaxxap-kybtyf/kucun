function loadLoadingPlan() {
  jest.resetModules();
  return require('../../erpxcx/utils/loading-plan');
}

describe('小程序报货计划载荷转换', () => {
  test('按装箱数把客户填报的件数转换成片数提交', () => {
    const { buildGoodsRequestItems } = loadLoadingPlan();

    const items = buildGoodsRequestItems([
      {
        id: '11111111-1111-4111-8111-111111111111',
        productSource: 'own',
        code: 'OWN-001',
        name: '雅士白罗马柱',
        specification: '800x800mm',
        unit: 'piece',
        unitLabel: '件',
        piecesPerUnit: 10,
        quantity: 2,
        quantityUnit: 'package',
        remark: '先装车',
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        productId: '11111111-1111-4111-8111-111111111111',
        temporaryProductId: undefined,
        productSource: 'own',
        productCode: 'OWN-001',
        productName: '雅士白罗马柱',
        specification: '800x800mm',
        unit: '片',
        quantity: 20,
      }),
    ]);
    expect(items[0].remarks).toContain('客户填报：2件');
    expect(items[0].remarks).toContain('折合20片');
    expect(items[0].remarks).toContain('备注：先装车');
  });

  test('无法换算片数的件数保留原提交单位', () => {
    const { buildGoodsRequestItems } = loadLoadingPlan();

    const items = buildGoodsRequestItems([
      {
        id: '33333333-3333-4333-8333-333333333333',
        source: 'external',
        code: 'EXT-001',
        name: '外采罗马柱',
        unit: 'piece',
        unitLabel: '件',
        quantity: 3,
        quantityUnit: 'package',
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        productId: undefined,
        temporaryProductId: '33333333-3333-4333-8333-333333333333',
        productSource: 'external',
        unit: '件',
        quantity: 3,
      }),
    ]);
    expect(items[0].remarks).toContain('客户填报：3件');
  });
});

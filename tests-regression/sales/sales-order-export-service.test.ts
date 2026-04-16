import { SalesOrderExportService } from '@/lib/services/sales-order-export-service';

describe('sales-order-export-service（收款文案回归）', () => {
  test('订单摘要应输出“已收金额”而不是“已付金额”', () => {
    const summary = (SalesOrderExportService as any).prepareOrderSummaryData({
      orderNumber: 'SO-001',
      customer: {
        name: '客户A',
        phone: '13800000000',
      },
      status: 'confirmed',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      shippedAt: new Date('2026-01-02T00:00:00.000Z'),
      items: [{ quantity: 10 }],
      totalAmount: 100,
      roundingAdjustment: 0,
      isSampleOrder: false,
      sampleSettlementType: null,
      paymentRecords: [
        {
          status: 'confirmed',
          paymentAmount: 60,
        },
      ],
      prepaymentUsages: [
        {
          appliedAmount: 20,
        },
      ],
      prepaymentTotalApplied: 20,
      remarks: '测试订单',
    });

    expect(summary).toEqual(
      expect.objectContaining({
        订单号: 'SO-001',
        客户名称: '客户A',
        已收金额: 80,
        未付金额: 20,
      })
    );
    expect('已付金额' in summary).toBe(false);
  });

  test('订单明细导出应优先使用销售单行自己的显示字段和重量快照', () => {
    const detailRows = (SalesOrderExportService as any).prepareOrderExcelData({
      items: [
        {
          isManualProduct: true,
          manualProductName: '临时大板',
          manualSpecification: '900x1800',
          productCode: 'TMP-900',
          displayUnit: 'piece',
          quantity: 13,
          piecesPerUnit: 12,
          manualWeight: 30,
          weightSnapshot: 30,
          unitPrice: 10,
          subtotal: 130,
          unitCost: 8,
          remarks: '测试备注',
          product: {
            name: '正式产品',
            code: 'REAL-001',
            specification: '800x800',
            unit: 'sheet',
            piecesPerUnit: 4,
            weight: 25,
          },
        },
      ],
    });

    expect(detailRows).toEqual([
      expect.objectContaining({
        产品名称: '临时大板',
        产品编号: 'TMP-900',
        规格: '900x1800',
        单位: '件',
        数量: '1件1片',
        '重量(kg)': 32.5,
      }),
    ]);
  });
});

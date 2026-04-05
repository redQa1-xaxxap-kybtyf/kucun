jest.mock('@/lib/services/csv-export-service', () => ({
  CSVExportService: {
    exportToCSV: jest.fn(),
  },
}));

jest.mock('@/lib/services/enhanced-excel-export-service', () => ({
  EnhancedExcelExportService: {
    exportToEnhancedExcel: jest.fn(),
    buildFilterSummary: jest.fn(() => '筛选条件'),
    generateFilename: jest.fn(() => '应付账款-筛选条件-测试员'),
  },
}));

import { PayablesExportService } from '@/lib/services/payables-export-service';

describe('payables-export-service（字段口径回归）', () => {
  const { CSVExportService } = jest.requireMock(
    '@/lib/services/csv-export-service'
  ) as {
    CSVExportService: { exportToCSV: jest.Mock };
  };

  const { EnhancedExcelExportService } = jest.requireMock(
    '@/lib/services/enhanced-excel-export-service'
  ) as {
    EnhancedExcelExportService: {
      exportToEnhancedExcel: jest.Mock;
      buildFilterSummary: jest.Mock;
      generateFilename: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const payable = {
    id: 'payable-1',
    payableNumber: 'PAY-001',
    supplierId: 'sup-1',
    userId: 'user-1',
    sourceType: 'purchase_order',
    sourceId: null,
    sourceNumber: 'PO-001',
    payableAmount: 100,
    paidAmount: 88,
    remainingAmount: 12,
    dueDate: new Date('2026-01-31T00:00:00.000Z'),
    status: 'partial',
    paymentTerms: null,
    description: null,
    remarks: '测试备注',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    dataTag: null,
    voidedAt: null,
    supplier: {
      name: '供应商A',
    },
  };

  test('prepareExportData 应输出“已核销金额”和“结算状态”语义字段', () => {
    const [row] = PayablesExportService.prepareExportData([payable as any]);

    expect(row).toEqual(
      expect.objectContaining({
        应付款编号: 'PAY-001',
        供应商名称: '供应商A',
        应付金额: 100,
        已核销金额: 88,
        剩余金额: 12,
        结算状态: '部分结清',
      })
    );
    expect('已付金额' in row).toBe(false);
    expect('付款状态' in row).toBe(false);
  });

  test('exportToCSV/exportToExcel 应使用“已核销金额”字段顺序与数值列配置', () => {
    PayablesExportService.exportToCSV([payable as any], 'payables.csv');
    PayablesExportService.exportToExcel([payable as any], 'payables.xlsx');

    expect(CSVExportService.exportToCSV).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        numberFields: ['应付金额', '已核销金额', '剩余金额'],
        fieldOrder: expect.arrayContaining(['应付金额', '已核销金额', '剩余金额']),
      })
    );

    expect(EnhancedExcelExportService.exportToEnhancedExcel).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        numberFields: ['应付金额', '已核销金额', '剩余金额'],
      })
    );
  });
});

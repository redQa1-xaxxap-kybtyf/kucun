jest.mock('@/lib/services/csv-export-service', () => ({
  CSVExportService: {
    exportToCSV: jest.fn(),
  },
}));

jest.mock('@/lib/services/enhanced-excel-export-service', () => ({
  EnhancedExcelExportService: {
    exportToEnhancedExcel: jest.fn(),
    buildFilterSummary: jest.fn(() => '筛选条件'),
    generateFilename: jest.fn(() => '应收账款-筛选条件-测试员'),
  },
}));

import { ReceivablesExportService } from '@/lib/services/receivables-export-service';

describe('receivables-export-service（字段口径回归）', () => {
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

  const receivable = {
    id: 'recv-1',
    orderNumber: 'SO-001',
    customerId: 'cust-1',
    customerName: '客户A',
    totalAmount: 120,
    paidAmount: 80,
    remainingAmount: 40,
    paymentStatus: 'partial',
    orderDate: '2026-01-01 10:00:00',
    lastPaymentDate: '2026-01-02 12:00:00',
  };

  test('prepareExportData 应输出“已收金额”而不是“已付金额”', () => {
    const [row] = ReceivablesExportService.prepareExportData([
      receivable as any,
    ]);

    expect(row).toEqual(
      expect.objectContaining({
        订单编号: 'SO-001',
        客户名称: '客户A',
        订单金额: 120,
        已收金额: 80,
        应收余额: 40,
      })
    );
    expect('已付金额' in row).toBe(false);
  });

  test('exportToCSV/exportToExcel 应使用“已收金额”字段顺序与数值列配置', () => {
    ReceivablesExportService.exportToCSV([receivable as any], 'receivables.csv');
    ReceivablesExportService.exportToExcel(
      [receivable as any],
      'receivables.xlsx'
    );

    expect(CSVExportService.exportToCSV).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        numberFields: ['订单金额', '已收金额', '应收余额'],
        fieldOrder: expect.arrayContaining(['订单金额', '已收金额', '应收余额']),
      })
    );

    expect(
      EnhancedExcelExportService.exportToEnhancedExcel
    ).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        numberFields: ['订单金额', '已收金额', '应收余额'],
      })
    );
  });
});

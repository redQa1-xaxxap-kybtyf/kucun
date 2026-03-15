import { createRoot } from 'react-dom/client';

import { createEmptyTemplate } from '@/lib/print-designer/schemas';
import {
  isPrintTemplateExportError,
  PrintTemplateExportService,
} from '@/lib/services/print-template-export-service';

jest.mock('@/lib/print-designer/actions', () => ({
  getDefaultTemplate: jest.fn(),
  getPrintDataForTemplate: jest.fn(),
}));

jest.mock('@/lib/services/export-service', () => ({
  ExportService: {
    exportToImage: jest.fn(),
  },
}));

jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(),
}));

const { getDefaultTemplate, getPrintDataForTemplate } = jest.requireMock(
  '@/lib/print-designer/actions'
) as {
  getDefaultTemplate: jest.Mock;
  getPrintDataForTemplate: jest.Mock;
};

const { ExportService } = jest.requireMock('@/lib/services/export-service') as {
  ExportService: {
    exportToImage: jest.Mock;
  };
};

describe('PrintTemplateExportService', () => {
  const render = jest.fn();
  const unmount = jest.fn();
  const mockedCreateRoot = createRoot as jest.Mock;
  const template = createEmptyTemplate(
    '00000000-0000-0000-0000-000000000001',
    '销售模板',
    'sales-order'
  );

  beforeEach(() => {
    mockedCreateRoot.mockReturnValue({ render, unmount });
    jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 1;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('exports a document with the default DIY template', async () => {
    getDefaultTemplate.mockResolvedValue({
      success: true,
      data: template,
    });
    getPrintDataForTemplate.mockResolvedValue({
      order: { orderNumber: 'SO-2026-0001' },
      items: [],
    });

    await PrintTemplateExportService.exportDocumentToImage({
      templateType: 'sales-order',
      documentId: 'order-1',
      filename: '销售订单-SO-2026-0001',
      scale: 2,
      backgroundColor: '#ffffff',
    });

    expect(getDefaultTemplate).toHaveBeenCalledWith('sales-order');
    expect(getPrintDataForTemplate).toHaveBeenCalledWith(
      'sales-order',
      'order-1'
    );
    expect(render).toHaveBeenCalledTimes(1);
    expect(ExportService.exportToImage).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        filename: '销售订单-SO-2026-0001',
        scale: 2,
        backgroundColor: '#ffffff',
      })
    );
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it('throws a typed error when the default template is missing', async () => {
    getDefaultTemplate.mockResolvedValue({
      success: true,
      data: undefined,
    });

    try {
      await PrintTemplateExportService.exportDataToImage({
        templateType: 'finance-monthly-report',
        data: {
          period: { label: '2026年3月' },
        },
        filename: '月度报表-2026-03',
      });
      throw new Error('expected exportDataToImage to reject');
    } catch (error) {
      expect(isPrintTemplateExportError(error)).toBe(true);
      if (isPrintTemplateExportError(error)) {
        expect(error.code).toBe('template_not_configured');
      }
    }

    expect(ExportService.exportToImage).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
  });
});

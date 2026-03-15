import { getMockPrintData } from '@/lib/print-designer/preview-mock-data';
import { getTemplateTypeMeta, getTemplateTypeLabel } from '@/lib/print-designer/template-meta';

describe('print preview metadata', () => {
  it('returns localized labels for known template types', () => {
    expect(getTemplateTypeLabel('sales-order')).toBe('销售订单');
    expect(getTemplateTypeLabel('purchase-order')).toBe('采购订单');
  });

  it('marks custom templates as mock-preview only', () => {
    expect(getTemplateTypeMeta('custom')?.supportsRealPreview).toBe(false);
  });
});

describe('getMockPrintData', () => {
  it('returns purchase-order mock data with supplier fields', () => {
    const data = getMockPrintData('purchase-order');

    expect(data).toMatchObject({
      order: expect.objectContaining({
        orderNumber: 'PO-2026-0012',
      }),
      supplier: expect.objectContaining({
        name: '佛山鸿瑞瓷砖厂',
      }),
    });
  });

  it('returns inbound-record mock data with single item row', () => {
    const data = getMockPrintData('inbound-record');

    expect(data).toMatchObject({
      order: expect.objectContaining({
        orderNumber: 'RK-2026-0188',
      }),
      items: [
        expect.objectContaining({
          code: 'RK-800-006',
        }),
      ],
    });
  });
});

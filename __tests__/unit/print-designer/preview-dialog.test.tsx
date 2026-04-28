import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PreviewDialog } from '@/components/print-designer/editor/components/PreviewDialog';
import { createEmptyTemplate } from '@/lib/print-designer/schemas';

jest.mock('@/lib/print-designer/preview-data-client', () => ({
  fetchRecentDocumentsForTemplate: jest.fn(),
  fetchPrintDataForTemplate: jest.fn(),
}));

const { fetchRecentDocumentsForTemplate, fetchPrintDataForTemplate } =
  jest.requireMock('@/lib/print-designer/preview-data-client') as {
    fetchRecentDocumentsForTemplate: jest.Mock;
    fetchPrintDataForTemplate: jest.Mock;
  };

describe('PreviewDialog', () => {
  beforeEach(() => {
    fetchRecentDocumentsForTemplate.mockResolvedValue([
      {
        id: 'po-1',
        label: 'PO-2026-0012',
        secondary: '佛山鸿瑞瓷砖厂',
        description: '创建于 2026-03-10',
      },
    ]);
    fetchPrintDataForTemplate.mockResolvedValue({
      order: { orderNumber: 'PO-2026-0012' },
      supplier: { name: '佛山鸿瑞瓷砖厂' },
      items: [],
      printDate: '2026-03-15',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads real documents according to template type', async () => {
    const template = createEmptyTemplate('tpl-preview', '采购模板', 'purchase-order');

    render(
      <PreviewDialog open onOpenChange={jest.fn()} template={template} />
    );

    fireEvent.click(screen.getByRole('button', { name: '真实采购单' }));

    await waitFor(() => {
      expect(fetchRecentDocumentsForTemplate).toHaveBeenCalledWith(
        'purchase-order',
        20
      );
    });

    await waitFor(() => {
      expect(fetchPrintDataForTemplate).toHaveBeenCalledWith(
        'purchase-order',
        'po-1'
      );
    });
  });

  it('supports real preview for delivery-note templates', async () => {
    const template = createEmptyTemplate(
      'tpl-delivery',
      '发货单模板',
      'delivery-note'
    );

    render(
      <PreviewDialog open onOpenChange={jest.fn()} template={template} />
    );

    fireEvent.click(screen.getByRole('button', { name: '真实发货单' }));

    await waitFor(() => {
      expect(fetchRecentDocumentsForTemplate).toHaveBeenCalledWith(
        'delivery-note',
        20
      );
    });
  });

  it('renders a hidden 100% print container separate from visible preview', async () => {
    const template = createEmptyTemplate('tpl-print', '销售模板', 'sales-order');

    render(
      <PreviewDialog open onOpenChange={jest.fn()} template={template} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('hidden-print-content')).toBeInTheDocument();
    });
  });

  it('does not show real-data switch for custom templates', async () => {
    const template = createEmptyTemplate('tpl-custom', '自定义模板', 'custom');

    render(
      <PreviewDialog open onOpenChange={jest.fn()} template={template} />
    );

    await act(async () => {});

    expect(screen.queryByRole('button', { name: '真实单据' })).not.toBeInTheDocument();
    expect(screen.getByText(/使用模拟数据预览版式/)).toBeInTheDocument();
  });
});

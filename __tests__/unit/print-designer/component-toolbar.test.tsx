import { act, render, screen } from '@testing-library/react';

import { ComponentToolbar } from '@/components/print-designer/editor/components/ComponentToolbar';
import { useDesignerStore } from '@/components/print-designer/editor/stores';
import { createEmptyTemplate } from '@/lib/print-designer/schemas';

describe('ComponentToolbar', () => {
  beforeEach(() => {
    act(() => {
      useDesignerStore.getState().reset();
    });
  });

  it('shows purchase-order fields for purchase templates', () => {
    act(() => {
      useDesignerStore.setState({
        template: createEmptyTemplate('tpl-1', '采购模板', 'purchase-order'),
      });
    });

    render(<ComponentToolbar />);

    expect(screen.getByText('采购单号')).toBeInTheDocument();
    expect(screen.getByText('供应商名称')).toBeInTheDocument();
    expect(screen.queryByText('客户名称')).not.toBeInTheDocument();
  });

  it('shows return-order specific fields for return templates', () => {
    act(() => {
      useDesignerStore.setState({
        template: createEmptyTemplate('tpl-2', '退货模板', 'return-order'),
      });
    });

    render(<ComponentToolbar />);

    expect(screen.getByText('退货单号')).toBeInTheDocument();
    expect(screen.getByText('退款金额')).toBeInTheDocument();
  });
});

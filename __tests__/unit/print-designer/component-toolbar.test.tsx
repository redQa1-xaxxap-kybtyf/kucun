import { act, fireEvent, render, screen } from '@testing-library/react';

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

    expect(screen.getAllByText('采购单号').length).toBeGreaterThan(0);
    expect(screen.getAllByText('供应商名称').length).toBeGreaterThan(0);
    expect(screen.queryByText('客户名称')).not.toBeInTheDocument();
  });

  it('shows return-order specific fields for return templates', () => {
    act(() => {
      useDesignerStore.setState({
        template: createEmptyTemplate('tpl-2', '退货模板', 'return-order'),
      });
    });

    render(<ComponentToolbar />);

    expect(screen.getAllByText('退货单号').length).toBeGreaterThan(0);
    expect(screen.getAllByText('退款金额').length).toBeGreaterThan(0);
  });

  it('inserts a labeled field pair when a field chip is clicked', () => {
    act(() => {
      useDesignerStore.setState({
        template: createEmptyTemplate('tpl-3', '销售模板', 'sales-order'),
      });
    });

    render(<ComponentToolbar />);

    fireEvent.click(screen.getAllByText('客户名称')[0]!);

    const nextTemplate = useDesignerStore.getState().template;

    expect(nextTemplate?.elements).toHaveLength(2);
    expect(nextTemplate?.elements[0]).toMatchObject({
      type: 'text',
      content: '客户名称：',
    });
    expect(nextTemplate?.elements[1]).toMatchObject({
      type: 'placeholder',
      field: 'customer.name',
      label: '客户名称',
    });
  });

  it('filters data fields with Chinese aliases and pinyin keywords', () => {
    act(() => {
      useDesignerStore.setState({
        template: createEmptyTemplate('tpl-4', '销售模板', 'sales-order'),
      });
    });

    render(<ComponentToolbar />);

    fireEvent.change(screen.getByLabelText('搜索业务数据项'), {
      target: { value: 'danhao' },
    });

    expect(screen.getAllByText('订单编号').length).toBeGreaterThan(0);
    expect(screen.queryByText('客户名称')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('清空数据项搜索'));

    expect(screen.getAllByText('客户名称').length).toBeGreaterThan(0);
  });
});

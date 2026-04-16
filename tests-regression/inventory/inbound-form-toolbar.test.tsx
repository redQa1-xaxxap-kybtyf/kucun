import { fireEvent, render, screen } from '@testing-library/react';

import { InboundFormToolbar } from '@/components/inventory/forms/inbound-form-toolbar';

describe('InboundFormToolbar', () => {
  test('传入 formId 时，工具栏提交按钮应绑定到对应表单', () => {
    const handleSubmit = jest.fn((event: Event) => {
      event.preventDefault();
    });

    render(
      <>
        <InboundFormToolbar
          isSubmitting={false}
          onReset={jest.fn()}
          onBack={jest.fn()}
          submitLabel="确认提交入库"
          formId="erp-inbound-form"
        />
        <form id="erp-inbound-form" onSubmit={handleSubmit} />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: '确认提交入库' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  test('未传入 formId 时，工具栏提交按钮应走手动提交回调', () => {
    const handleSubmit = jest.fn();

    render(
      <InboundFormToolbar
        isSubmitting={false}
        onReset={jest.fn()}
        onSubmit={handleSubmit}
        onBack={jest.fn()}
        submitLabel="确认提交入库"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '确认提交入库' }));

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataManagementExecuteDialog } from '@/app/(dashboard)/settings/data-management/components/DataManagementDialogs';

describe('DataManagementExecuteDialog', () => {
  test('确认执行时不会先自动关闭弹窗并清空确认词', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();
    const onConfirmTextChange = jest.fn();
    const onExecute = jest.fn();

    render(
      <DataManagementExecuteDialog
        open={true}
        onOpenChange={onOpenChange}
        action="reset_trial"
        systemMode="trial"
        confirmWord="重置"
        confirmText="重置"
        onConfirmTextChange={onConfirmTextChange}
        isExecuting={false}
        onExecute={onExecute}
      />
    );

    await user.click(screen.getByRole('button', { name: '确认执行' }));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(onConfirmTextChange).not.toHaveBeenCalledWith('');
  });
});

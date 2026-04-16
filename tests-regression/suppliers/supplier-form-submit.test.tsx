import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import CreateSupplierPageClient from '@/app/(dashboard)/suppliers/create/page-client';
import { EditSupplierForm } from '@/app/(dashboard)/suppliers/[id]/edit/EditSupplierForm';
import { createSupplier, updateSupplier } from '@/lib/api/suppliers';

jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

jest.mock('@/lib/api/suppliers', () => ({
  createSupplier: jest.fn(),
  updateSupplier: jest.fn(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('Supplier form submit regression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('供应商新建页底部按钮应通过原生表单提交触发创建', async () => {
    (createSupplier as jest.Mock).mockResolvedValue({
      success: true,
      message: 'ok',
    });

    render(<CreateSupplierPageClient />, {
      wrapper: createWrapper(),
    });

    fireEvent.change(screen.getByPlaceholderText('请输入供应商名称'), {
      target: { value: '测试供应商' },
    });

    fireEvent.click(screen.getByRole('button', { name: '新建供应商' }));

    await waitFor(() => {
      expect(createSupplier).toHaveBeenCalledTimes(1);
    });

    expect((createSupplier as jest.Mock).mock.calls[0]?.[0]).toEqual({
      name: '测试供应商',
      phone: undefined,
      address: undefined,
    });
  });

  test('供应商编辑页底部按钮应通过原生表单提交触发更新', async () => {
    (updateSupplier as jest.Mock).mockResolvedValue({
      success: true,
      message: 'ok',
    });

    render(
      <EditSupplierForm
        id="supplier-1"
        supplier={{
          name: '原供应商',
          phone: '13800138000',
          address: '佛山',
          status: 'active',
        }}
      />,
      { wrapper: createWrapper() }
    );

    const nameInput = await screen.findByDisplayValue('原供应商');

    fireEvent.change(nameInput, {
      target: { value: '已更新供应商' },
    });

    fireEvent.click(screen.getByRole('button', { name: '更新供应商' }));

    await waitFor(() => {
      expect(updateSupplier).toHaveBeenCalledTimes(1);
    });

    expect((updateSupplier as jest.Mock).mock.calls[0]?.[0]).toBe('supplier-1');
    expect((updateSupplier as jest.Mock).mock.calls[0]?.[1]).toEqual({
      name: '已更新供应商',
      phone: '13800138000',
      address: '佛山',
      status: 'active',
    });
  });
});

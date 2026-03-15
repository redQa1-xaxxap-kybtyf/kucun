const mockPrintTemplate = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
  delete: jest.fn(),
};

const mockRequireAdminUser = jest.fn();
const mockRequireAuthUser = jest.fn();
const mockRevalidatePath = jest.fn();

jest.mock('@/lib/db', () => ({
  prisma: {
    printTemplate: mockPrintTemplate,
  },
}));

jest.mock('@/lib/print-designer/actions/auth', () => ({
  requireAdminUser: mockRequireAdminUser,
  requireAuthUser: mockRequireAuthUser,
}));

jest.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

import {
  getDefaultTemplate,
  getTemplates,
  setDefaultTemplate,
} from '@/lib/print-designer/actions/template-crud';
import { SYSTEM_TEMPLATE_IDS } from '@/lib/print-designer/system-templates';

describe('template-crud system template fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAdminUser.mockResolvedValue({ id: 'admin-user' });
    mockRequireAuthUser.mockResolvedValue({ id: 'normal-user' });
  });

  it('returns the built-in default template when the database has no default', async () => {
    mockPrintTemplate.findFirst.mockResolvedValue(null);

    const result = await getDefaultTemplate('finance-monthly-report');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.objectContaining({
        id: SYSTEM_TEMPLATE_IDS['finance-monthly-report'],
        type: 'finance-monthly-report',
        name: '系统默认月度报表模板',
      })
    );
    expect(result.data?.elements.length).toBeGreaterThan(0);
  });

  it('includes built-in templates in the template list when no records exist yet', async () => {
    mockPrintTemplate.findMany.mockResolvedValue([]);

    const result = await getTemplates();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: SYSTEM_TEMPLATE_IDS['sales-order'],
          type: 'sales-order',
          isDefault: true,
          isSystem: true,
        }),
        expect.objectContaining({
          id: SYSTEM_TEMPLATE_IDS['finance-annual-report'],
          type: 'finance-annual-report',
          isDefault: true,
          isSystem: true,
        }),
      ])
    );
  });

  it('persists a built-in template when setting a virtual system template as default', async () => {
    mockPrintTemplate.updateMany.mockResolvedValue({ count: 0 });
    mockPrintTemplate.findUnique.mockResolvedValue(null);
    mockPrintTemplate.create.mockResolvedValue({ id: SYSTEM_TEMPLATE_IDS['delivery-note'] });

    const result = await setDefaultTemplate(
      SYSTEM_TEMPLATE_IDS['delivery-note'],
      'delivery-note'
    );

    expect(result.success).toBe(true);
    expect(mockPrintTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: SYSTEM_TEMPLATE_IDS['delivery-note'],
          type: 'delivery-note',
          isDefault: true,
          isSystem: true,
          createdBy: 'admin-user',
          updatedBy: 'admin-user',
        }),
      })
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/print-templates');
  });
});

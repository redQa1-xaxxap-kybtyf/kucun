import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/auth/api-helpers';
import {
  getMiniProgramCatalogSettings,
  updateMiniProgramCatalogSettings,
  updateMiniProgramProductDisplayOverride,
  updateMiniProgramProductDisplayOverrides,
} from '@/lib/services/miniprogram-catalog-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const urlSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .nullable()
  .transform(value => (value && value.length > 0 ? value : null));

const colorSeriesSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(30),
  coverUrl: urlSchema,
  sortOrder: z.coerce.number().int().min(1).max(999),
  visible: z.boolean(),
});

const componentTypeSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(30),
  coverUrl: urlSchema,
  sortOrder: z.coerce.number().int().min(1).max(999),
  visible: z.boolean(),
});

const catalogSettingsSchema = z.object({
  colorSeries: z.array(colorSeriesSchema).optional(),
  componentTypes: z.array(componentTypeSchema).optional(),
});

const miniDisplaySchema = z.object({
  visible: z.boolean().optional(),
  seriesId: z.string().min(1).max(64).optional(),
  componentType: z.string().min(1).max(64).optional(),
  sortOrder: z.coerce.number().int().min(1).max(999).optional(),
  displayGroupName: z.string().trim().max(40).optional(),
  displayGroupOrder: z.coerce.number().int().min(1).max(99).optional(),
});

const productDisplaySchema = z.object({
  productId: z.string().min(1),
  display: miniDisplaySchema,
});

const productDisplayBatchSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(200),
  display: miniDisplaySchema,
});

const productDisplayPatchSchema = z.union([
  productDisplaySchema,
  productDisplayBatchSchema,
]);

export const GET = withAuth(
  async () => {
    const data = await getMiniProgramCatalogSettings();

    return NextResponse.json({
      success: true,
      data,
    });
  },
  { requireAdmin: true }
);

export const PUT = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = catalogSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: '小程序分类设置格式不正确',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const data = await updateMiniProgramCatalogSettings(parsed.data);
    return NextResponse.json({
      success: true,
      data,
      message: '小程序分类设置已保存',
    });
  },
  { requireAdmin: true }
);

export const PATCH = withAuth(
  async (request: NextRequest) => {
    const body = await request.json();
    const parsed = productDisplayPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: '产品展示设置格式不正确',
          details: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    if ('productIds' in parsed.data) {
      const data = await updateMiniProgramProductDisplayOverrides(
        parsed.data.productIds,
        parsed.data.display
      );

      return NextResponse.json({
        success: true,
        data,
        message: `已批量保存 ${data.updatedCount} 个产品`,
      });
    }

    const data = await updateMiniProgramProductDisplayOverride(
      parsed.data.productId,
      parsed.data.display
    );

    return NextResponse.json({
      success: true,
      data,
      message: '产品小程序展示分类已保存',
    });
  },
  { permissions: ['products:edit'] }
);

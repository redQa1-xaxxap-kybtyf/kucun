/**
 * 打印设计器 - 模板 CRUD Server Actions
 */

'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import {
  PrintTemplateSchema,
  type PrintTemplate,
} from '@/lib/print-designer/schemas';

import { requireAdminUser, requireAuthUser } from './auth';

// ============================================================================
// 类型定义
// ============================================================================

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

interface TemplateListItem {
  id: string;
  name: string;
  type: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 权限检查
// ============================================================================

// ============================================================================
// CRUD Actions
// ============================================================================

/**
 * 获取模板列表
 */
export async function getTemplates(
  type?: string
): Promise<ActionResult<TemplateListItem[]>> {
  try {
    await requireAdminUser();

    const templates = await prisma.printTemplate.findMany({
      where: type ? { type } : undefined,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        name: true,
        type: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      success: true,
      data: templates.map(t => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取模板列表失败',
    };
  }
}

/**
 * 获取单个模板
 */
export async function getTemplate(
  id: string
): Promise<ActionResult<PrintTemplate>> {
  try {
    await requireAdminUser();

    const template = await prisma.printTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return { success: false, error: '模板不存在' };
    }

    // 解析 content JSON
    const content = template.content as unknown as PrintTemplate;

    return {
      success: true,
      data: content,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取模板失败',
    };
  }
}

/**
 * 保存模板 (创建或更新)
 */
export async function saveTemplate(
  template: PrintTemplate
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = (await requireAdminUser()).id;

    // 验证模板数据
    const validation = PrintTemplateSchema.safeParse(template);
    if (!validation.success) {
      return {
        success: false,
        error: `模板数据无效: ${validation.error.message}`,
      };
    }

    const validTemplate = validation.data;

    // 检查是否已存在
    const existing = await prisma.printTemplate.findUnique({
      where: { id: validTemplate.id },
    });

    if (existing) {
      // 更新
      await prisma.printTemplate.update({
        where: { id: validTemplate.id },
        data: {
          name: validTemplate.name,
          type: validTemplate.type,
          content: JSON.parse(JSON.stringify(validTemplate)),
          updatedBy: userId,
        },
      });
    } else {
      // 创建
      await prisma.printTemplate.create({
        data: {
          id: validTemplate.id,
          name: validTemplate.name,
          type: validTemplate.type,
          content: JSON.parse(JSON.stringify(validTemplate)),
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    revalidatePath('/settings/print-templates');

    return {
      success: true,
      data: { id: validTemplate.id },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '保存模板失败',
    };
  }
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string): Promise<ActionResult> {
  try {
    await requireAdminUser();

    await prisma.printTemplate.delete({
      where: { id },
    });

    revalidatePath('/settings/print-templates');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除模板失败',
    };
  }
}

/**
 * 设置默认模板
 */
export async function setDefaultTemplate(
  id: string,
  type: string
): Promise<ActionResult> {
  try {
    await requireAdminUser();

    // 先取消同类型的其他默认模板
    await prisma.printTemplate.updateMany({
      where: { type, isDefault: true },
      data: { isDefault: false },
    });

    // 设置当前模板为默认
    await prisma.printTemplate.update({
      where: { id },
      data: { isDefault: true },
    });

    revalidatePath('/settings/print-templates');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '设置默认模板失败',
    };
  }
}

/**
 * 复制模板
 */
export async function duplicateTemplate(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const userId = (await requireAdminUser()).id;

    const original = await prisma.printTemplate.findUnique({
      where: { id },
    });

    if (!original) {
      return { success: false, error: '原模板不存在' };
    }

    const content = original.content as unknown as PrintTemplate;
    const newId = crypto.randomUUID();

    await prisma.printTemplate.create({
      data: {
        id: newId,
        name: `${original.name} (副本)`,
        type: original.type,
        content: JSON.parse(
          JSON.stringify({
            ...content,
            id: newId,
            name: `${content.name} (副本)`,
          })
        ),
        isDefault: false,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    revalidatePath('/settings/print-templates');

    return {
      success: true,
      data: { id: newId },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '复制模板失败',
    };
  }
}

/**
 * 获取指定类型的默认模板
 */
export async function getDefaultTemplate(
  type: string
): Promise<ActionResult<PrintTemplate | null>> {
  try {
    await requireAuthUser();

    const template = await prisma.printTemplate.findFirst({
      where: { type, isDefault: true },
    });

    if (!template) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: template.content as unknown as PrintTemplate,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取默认模板失败',
    };
  }
}

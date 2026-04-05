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
import {
  getSystemTemplate,
  getSystemTemplateById,
  isSystemTemplateId,
  listSystemTemplates,
} from '@/lib/print-designer/system-templates';

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
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// 权限检查
// ============================================================================

function serializeTemplate(template: PrintTemplate) {
  return JSON.parse(JSON.stringify(template));
}

function parseTemplateContent(content: unknown): PrintTemplate | null {
  const result = PrintTemplateSchema.safeParse(content);
  return result.success ? result.data : null;
}

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
        isSystem: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const existingIds = new Set(templates.map(template => template.id));
    const persistedDefaultTypes = new Set(
      templates
        .filter(template => template.isDefault)
        .map(template => template.type)
    );

    const virtualSystemTemplates = listSystemTemplates(type)
      .filter(template => !existingIds.has(template.id))
      .map<TemplateListItem>(template => ({
        id: template.id,
        name: template.name,
        type: template.type,
        isDefault: !persistedDefaultTypes.has(template.type),
        isSystem: true,
        createdAt: template.createdAt ?? new Date().toISOString(),
        updatedAt: template.updatedAt ?? new Date().toISOString(),
      }));

    return {
      success: true,
      data: [...templates, ...virtualSystemTemplates]
        .map(template => ({
          ...template,
          createdAt:
            typeof template.createdAt === 'string'
              ? template.createdAt
              : template.createdAt.toISOString(),
          updatedAt:
            typeof template.updatedAt === 'string'
              ? template.updatedAt
              : template.updatedAt.toISOString(),
        }))
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
          }

          if (left.isSystem !== right.isSystem) {
            return left.isSystem ? -1 : 1;
          }

          return right.updatedAt.localeCompare(left.updatedAt);
        }),
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

    if (template) {
      const content = parseTemplateContent(template.content);
      if (!content) {
        return { success: false, error: '模板数据无效，无法加载' };
      }

      return {
        success: true,
        data: content,
      };
    }

    const systemTemplate = getSystemTemplateById(id);
    if (systemTemplate) {
      return {
        success: true,
        data: systemTemplate,
      };
    }

    return { success: false, error: '模板不存在' };
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
    const systemTemplate = getSystemTemplateById(validTemplate.id);
    const shouldPersistAsSystem = systemTemplate?.type === validTemplate.type;

    if (existing) {
      // 更新
      await prisma.printTemplate.update({
        where: { id: validTemplate.id },
        data: {
          name: validTemplate.name,
          description: validTemplate.description,
          type: validTemplate.type,
          content: serializeTemplate(validTemplate),
          isSystem: existing.isSystem || shouldPersistAsSystem,
          updatedBy: userId,
        },
      });
    } else {
      const hasDefaultTemplate = await prisma.printTemplate.findFirst({
        where: { type: validTemplate.type, isDefault: true },
        select: { id: true },
      });

      // 创建
      await prisma.printTemplate.create({
        data: {
          id: validTemplate.id,
          name: validTemplate.name,
          description: validTemplate.description,
          type: validTemplate.type,
          content: serializeTemplate(validTemplate),
          isDefault: shouldPersistAsSystem ? !hasDefaultTemplate : false,
          isSystem: shouldPersistAsSystem,
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

    const existing = await prisma.printTemplate.findUnique({
      where: { id },
      select: { isSystem: true },
    });

    if (existing?.isSystem || isSystemTemplateId(id)) {
      return {
        success: false,
        error: '系统内置模板不可删除，请复制后编辑自定义版本。',
      };
    }

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
    const userId = (await requireAdminUser()).id;

    // 先取消同类型的其他默认模板
    await prisma.printTemplate.updateMany({
      where: { type, isDefault: true },
      data: { isDefault: false },
    });

    const existing = await prisma.printTemplate.findUnique({
      where: { id },
    });

    if (existing) {
      await prisma.printTemplate.update({
        where: { id },
        data: { isDefault: true, updatedBy: userId },
      });
    } else {
      const systemTemplate = getSystemTemplateById(id);

      if (!systemTemplate || systemTemplate.type !== type) {
        return { success: false, error: '模板不存在' };
      }

      await prisma.printTemplate.create({
        data: {
          id: systemTemplate.id,
          name: systemTemplate.name,
          description: systemTemplate.description,
          type: systemTemplate.type,
          content: serializeTemplate(systemTemplate),
          isDefault: true,
          isSystem: true,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

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

    const storedOriginal = await prisma.printTemplate.findUnique({
      where: { id },
    });

    const originalTemplate =
      storedOriginal?.content ?? getSystemTemplateById(id) ?? null;

    if (!originalTemplate) {
      return { success: false, error: '原模板不存在' };
    }

    const content = parseTemplateContent(originalTemplate);
    if (!content) {
      return { success: false, error: '原模板数据无效，无法复制' };
    }

    const newId = crypto.randomUUID();
    const nextName = `${content.name} (副本)`;

    await prisma.printTemplate.create({
      data: {
        id: newId,
        name: nextName,
        description: content.description,
        type: content.type,
        content: serializeTemplate({
          ...content,
          id: newId,
          name: nextName,
        }),
        isDefault: false,
        isSystem: false,
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
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (template) {
      const content = parseTemplateContent(template.content);
      if (content) {
        return {
          success: true,
          data: content,
        };
      }
    }

    const systemTemplate = getSystemTemplate(type);

    return {
      success: true,
      data: systemTemplate,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取默认模板失败',
    };
  }
}

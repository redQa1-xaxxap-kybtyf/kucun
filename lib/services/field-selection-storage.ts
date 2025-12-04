/**
 * 字段选择持久化服务
 *
 * 功能:
 * - 保存字段选择配置到localStorage
 * - 加载已保存的配置
 * - 重置为默认配置
 *
 * 设计原则:
 * - 单一职责: 仅负责字段选择的持久化
 * - 类型安全: 完整的TypeScript类型定义
 */

import type { DocumentType, FieldSelection } from '@/lib/types/print-config';

/**
 * localStorage键名前缀
 */
const STORAGE_KEY_PREFIX = 'print-field-selection';

/**
 * 生成存储键名
 */
function getStorageKey(documentType: DocumentType): string {
  return `${STORAGE_KEY_PREFIX}:${documentType}`;
}

/**
 * 保存字段选择配置
 *
 * @param documentType - 文档类型
 * @param selection - 字段选择配置
 */
export function saveFieldSelection(
  documentType: DocumentType,
  selection: FieldSelection
): void {
  try {
    const key = getStorageKey(documentType);
    const data = JSON.stringify(selection);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error('保存字段选择失败:', error);
  }
}

/**
 * 加载字段选择配置
 *
 * @param documentType - 文档类型
 * @returns 字段选择配置,如果不存在则返回null
 */
export function loadFieldSelection(
  documentType: DocumentType
): FieldSelection | null {
  try {
    const key = getStorageKey(documentType);
    const data = localStorage.getItem(key);

    if (!data) {
      return null;
    }

    const selection = JSON.parse(data) as FieldSelection;

    // 验证数据结构
    if (
      !selection ||
      !Array.isArray(selection.headerKeys) ||
      !Array.isArray(selection.itemKeys) ||
      !Array.isArray(selection.summaryKeys)
    ) {
      console.warn('字段选择数据格式无效,已忽略');
      return null;
    }

    return selection;
  } catch (error) {
    console.error('加载字段选择失败:', error);
    return null;
  }
}

/**
 * 删除保存的字段选择配置
 *
 * @param documentType - 文档类型
 */
export function clearFieldSelection(documentType: DocumentType): void {
  try {
    const key = getStorageKey(documentType);
    localStorage.removeItem(key);
  } catch (error) {
    console.error('删除字段选择失败:', error);
  }
}

/**
 * 获取所有已保存的文档类型
 */
export function getSavedDocumentTypes(): DocumentType[] {
  try {
    const keys = Object.keys(localStorage);
    const documentTypes: DocumentType[] = [];

    for (const key of keys) {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        const type = key.replace(`${STORAGE_KEY_PREFIX}:`, '') as DocumentType;
        documentTypes.push(type);
      }
    }

    return documentTypes;
  } catch (error) {
    console.error('获取保存的文档类型失败:', error);
    return [];
  }
}

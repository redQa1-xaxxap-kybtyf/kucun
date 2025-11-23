/**
 * 打印模板存储服务
 *
 * 功能：
 * - 模板的保存、加载、删除
 * - 默认模板的设置和获取
 * - 使用 localStorage 存储（未来可扩展为服务端同步）
 *
 * 设计原则：
 * - 单一职责：仅负责模板的持久化
 * - 开放封闭：易于扩展存储后端（localStorage → IndexedDB → 服务端）
 */

import { logger } from '@/lib/logger';
import type { DocumentType } from '@/lib/types/print-config';
import type { PrintStyleConfig } from '@/lib/types/print-style';

/**
 * 存储键名常量
 */
const STORAGE_KEYS = {
  TEMPLATES: 'print_templates',
  DEFAULT_PREFIX: 'print_default_',
} as const;

/**
 * 存储错误类
 */
export class TemplateStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateStorageError';
  }
}

/**
 * 打印模板存储服务
 *
 * 使用静态方法，无需实例化
 */
export class PrintTemplateService {
  /**
   * 检查是否支持 localStorage
   */
  private static isLocalStorageAvailable(): boolean {
    try {
      const test = '__localStorage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 安全地解析 JSON
   */
  private static safeParseJSON<T>(jsonStr: string | null, fallback: T): T {
    if (!jsonStr) {
      return fallback;
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      logger.error('print-template', 'JSON 解析失败', error);
      return fallback;
    }
  }

  /**
   * 获取所有已保存的模板
   *
   * @param documentType - 可选，筛选特定文档类型的模板
   * @returns 模板列表
   */
  static getTemplates(documentType?: DocumentType): PrintStyleConfig[] {
    if (!this.isLocalStorageAvailable()) {
      logger.warn('print-template', 'localStorage 不可用');
      return [];
    }

    const stored = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    const templates = this.safeParseJSON<PrintStyleConfig[]>(stored, []);

    if (documentType) {
      return templates.filter(t => t.documentType === documentType);
    }

    return templates;
  }

  /**
   * 根据 ID 获取模板
   *
   * @param id - 模板 ID
   * @returns 模板配置，未找到返回 null
   */
  static getTemplateById(id: string): PrintStyleConfig | null {
    const templates = this.getTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * 保存模板
   *
   * @param config - 模板配置
   * @returns 保存后的模板 ID
   * @throws {TemplateStorageError} 当 localStorage 不可用时
   */
  static saveTemplate(config: PrintStyleConfig): string {
    if (!this.isLocalStorageAvailable()) {
      throw new TemplateStorageError('localStorage 不可用，无法保存模板');
    }

    const templates = this.getTemplates();
    const id =
      config.id ||
      `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const newConfig: PrintStyleConfig = {
      ...config,
      id,
      updatedAt: now,
      createdAt: config.createdAt || now,
    };

    // 更新或添加模板
    const index = templates.findIndex(t => t.id === id);
    if (index >= 0) {
      templates[index] = newConfig;
    } else {
      templates.push(newConfig);
    }

    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
      return id;
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new TemplateStorageError('存储空间不足，无法保存模板');
      }
      throw new TemplateStorageError('保存模板失败');
    }
  }

  /**
   * 删除模板
   *
   * @param id - 模板 ID
   * @returns 是否删除成功
   */
  static deleteTemplate(id: string): boolean {
    if (!this.isLocalStorageAvailable()) {
      logger.warn('print-template', 'localStorage 不可用');
      return false;
    }

    const templates = this.getTemplates();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) {
      // 未找到要删除的模板
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(filtered));
      return true;
    } catch (error) {
      logger.error('print-template', '删除模板失败', error);
      return false;
    }
  }

  /**
   * 获取默认模板（上次使用的模板）
   *
   * @param documentType - 文档类型
   * @returns 默认模板配置，未设置返回 null
   */
  static getDefaultTemplate(
    documentType: DocumentType
  ): PrintStyleConfig | null {
    if (!this.isLocalStorageAvailable()) {
      return null;
    }

    const key = `${STORAGE_KEYS.DEFAULT_PREFIX}${documentType}`;
    const stored = localStorage.getItem(key);

    return this.safeParseJSON<PrintStyleConfig | null>(stored, null);
  }

  /**
   * 设置默认模板
   *
   * @param documentType - 文档类型
   * @param config - 模板配置
   */
  static setDefaultTemplate(
    documentType: DocumentType,
    config: PrintStyleConfig
  ): void {
    if (!this.isLocalStorageAvailable()) {
      logger.warn('print-template', 'localStorage 不可用');
      return;
    }

    const key = `${STORAGE_KEYS.DEFAULT_PREFIX}${documentType}`;

    try {
      localStorage.setItem(key, JSON.stringify(config));
    } catch (error) {
      logger.error('print-template', '设置默认模板失败', error);
    }
  }

  /**
   * 清除默认模板
   *
   * @param documentType - 文档类型
   */
  static clearDefaultTemplate(documentType: DocumentType): void {
    if (!this.isLocalStorageAvailable()) {
      return;
    }

    const key = `${STORAGE_KEYS.DEFAULT_PREFIX}${documentType}`;
    localStorage.removeItem(key);
  }

  /**
   * 清除所有模板（慎用）
   */
  static clearAllTemplates(): void {
    if (!this.isLocalStorageAvailable()) {
      return;
    }

    localStorage.removeItem(STORAGE_KEYS.TEMPLATES);

    // 清除所有默认模板
    const documentTypes: DocumentType[] = [
      'sales-order',
      'purchase-order',
      'factory-shipment',
    ];
    documentTypes.forEach(type => this.clearDefaultTemplate(type));
  }

  /**
   * 导出所有模板为 JSON
   *
   * @returns JSON 字符串
   */
  static exportTemplates(): string {
    const templates = this.getTemplates();
    return JSON.stringify(templates, null, 2);
  }

  /**
   * 从 JSON 导入模板
   *
   * @param jsonStr - JSON 字符串
   * @returns 导入的模板数量
   * @throws {TemplateStorageError} 当导入失败时
   */
  static importTemplates(jsonStr: string): number {
    let templates: PrintStyleConfig[];

    try {
      templates = JSON.parse(jsonStr) as PrintStyleConfig[];
    } catch {
      throw new TemplateStorageError('无效的 JSON 格式');
    }

    if (!Array.isArray(templates)) {
      throw new TemplateStorageError('导入数据必须是数组');
    }

    const existingTemplates = this.getTemplates();
    const mergedTemplates = [...existingTemplates];

    templates.forEach(template => {
      const index = mergedTemplates.findIndex(t => t.id === template.id);
      if (index >= 0) {
        mergedTemplates[index] = template;
      } else {
        mergedTemplates.push(template);
      }
    });

    try {
      localStorage.setItem(
        STORAGE_KEYS.TEMPLATES,
        JSON.stringify(mergedTemplates)
      );
      return templates.length;
    } catch {
      throw new TemplateStorageError('导入模板失败');
    }
  }
}

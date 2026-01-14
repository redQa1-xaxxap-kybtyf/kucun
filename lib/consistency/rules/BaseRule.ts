/**
 * 基础规则类 - 提供通用功能
 */

import type { IConsistencyRule } from './IConsistencyRule';
import type { EntityType, RuleConfig, RuleContext, RuleOutput } from './types';

export abstract class BaseRule implements IConsistencyRule {
  abstract readonly ruleName: string;
  abstract config: RuleConfig;
  abstract supportsIncrementalScan: boolean;

  /**
   * 子类必须实现的检查逻辑
   */
  abstract checkInternal(context: RuleContext): Promise<RuleOutput[]>;

  /**
   * 生成去重键（默认实现）
   */
  generateDedupeKey(output: RuleOutput): string {
    const template =
      this.config.dedupeKeyTemplate ||
      '{ruleName}:{entityType}:{entityId}:{diffHash}';

    // 生成差异内容的简单哈希
    const diffStr = JSON.stringify(output.details);
    const diffHash = this.hashString(diffStr);

    return template
      .replace('{ruleName}', this.ruleName)
      .replace('{entityType}', output.entityType)
      .replace('{entityId}', output.entityId)
      .replace('{diffHash}', diffHash);
  }

  /**
   * 检查入口（应用增量过滤）
   */
  async check(context: RuleContext): Promise<RuleOutput[]> {
    let where: Record<string, unknown> = {};
    let windowStart: Date | undefined;

    // 应用增量过滤条件
    if (this.config.windowMinutes) {
      windowStart = new Date(
        Date.now() - this.config.windowMinutes * 60 * 1000
      );
      where.updatedAt = { gte: windowStart };
    }

    if (this.config.checkRecentChangesOnly && windowStart) {
      // 只检查最近有变更的实体（需要 windowStart 已定义）
      where = {
        ...where,
        OR: [
          { updatedAt: { gte: windowStart } },
          { createdAt: { gte: windowStart } },
        ],
      };
    }

    // 创建上下文扩展（包含增量过滤条件）
    const contextWithFilters: RuleContext & {
      whereFilters: Record<string, unknown>;
    } = {
      ...context,
      whereFilters: where,
    };

    return this.checkInternal(contextWithFilters);
  }

  /**
   * 简单字符串哈希（用于去重）
   */
  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 创建异常输出
   */
  protected createOutput(
    entityType: EntityType,
    entityId: string,
    details: Record<string, unknown>
  ): RuleOutput {
    return {
      ruleName: this.ruleName,
      severity: this.config.severity,
      entityType,
      entityId,
      details,
      observedAt: new Date(),
    };
  }

  /**
   * 分页查询辅助方法
   */
  protected async queryWithPagination<T>(
    queryFn: (take: number, skip: number) => Promise<T[]>,
    options: {
      batchSize?: number;
      maxRecords?: number;
    } = {}
  ): Promise<T[]> {
    const { batchSize = 100, maxRecords = 10000 } = options;
    const results: T[] = [];
    let pageIndex = 0;

    while (results.length < maxRecords) {
      const skip = pageIndex * batchSize;
      const remaining = maxRecords - results.length;
      const take = Math.min(batchSize, remaining);

      const items = await queryFn(take, skip);
      if (items.length === 0) break;

      results.push(...items);

      if (items.length < take) break;
      pageIndex += 1;
    }

    return results;
  }
}

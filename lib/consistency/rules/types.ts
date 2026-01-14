/**
 * 一致性监控规则库 - 核心类型定义
 */

export enum RuleSeverity {
  P0 = 'P0', // 紧急：数据不一致或可能丢失
  P1 = 'P1', // 重要：可能影响业务决策
  P2 = 'P2', // 一般：数据质量问题
}

export type EntityType =
  | 'inventory'
  | 'sales_order'
  | 'outbound_record'
  | 'payment_record'
  | 'inbound_record'
  | 'inventory_cost_queue'
  | 'account_statement';

export interface RuleOutput {
  ruleName: string;
  severity: RuleSeverity;
  entityType: EntityType;
  entityId: string;
  details: Record<string, unknown>;
  observedAt: Date;
}

export interface RuleConfig {
  name: string;
  description: string;
  severity: RuleSeverity;
  entityType: EntityType;
  // 增量扫描参数
  windowMinutes?: number; // 只检查最近 N 分钟内更新的实体
  checkRecentChangesOnly?: boolean; // 是否只检查最近有变更的实体
  // 分片参数
  batchSize?: number;
  maxRecordsToCheck?: number;
  // 阈值参数
  threshold?: {
    field: string;
    operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
    value: number | string;
  };
  // 去重参数
  dedupeKeyTemplate?: string; // 模板，例如 '{ruleName}:{entityType}:{entityId}:{diffHash}'
}

export interface RuleContext {
  windowStart?: Date;
  windowEnd?: Date;
  batchSize: number;
  maxRecords: number;
  dryRun?: boolean;
  whereFilters?: Record<string, unknown>;
}

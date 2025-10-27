import type { ReceivablesParams } from '@/lib/schemas/receivables-params';

export type SortOrder = 'asc' | 'desc';

/**
 * ✅ 重构：使用 schema 推导的类型确保类型一致性
 */
export type ReceivablesQueryParams = ReceivablesParams;

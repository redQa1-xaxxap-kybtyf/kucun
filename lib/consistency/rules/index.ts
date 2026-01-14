/**
 * 一致性监控规则索引
 * 所有规则的统一导入和导出
 */

import { InventoryConsistencyRule } from './R1_InventoryConsistencyRule';
import { FifoInventoryConsistencyRule } from './R2_FifoInventoryConsistencyRule';
import { OutboundInventoryConsistencyRule } from './R3_OutboundInventoryConsistencyRule';
import { SalesOrderStatusConsistencyRule } from './R4_SalesOrderStatusConsistencyRule';
import { ReceivablesConsistencyRule } from './R5_ReceivablesConsistencyRule';
import { PaymentConsistencyRule } from './R6_PaymentConsistencyRule';

export const CONSISTENCY_RULES = [
  new InventoryConsistencyRule(),
  new FifoInventoryConsistencyRule(),
  new OutboundInventoryConsistencyRule(),
  new SalesOrderStatusConsistencyRule(),
  new ReceivablesConsistencyRule(),
  new PaymentConsistencyRule(),
] as const;

// 根据规则名称获取规则
export function getRuleByName(
  ruleName: string
): (typeof CONSISTENCY_RULES)[number] | undefined {
  return CONSISTENCY_RULES.find(rule => rule.ruleName === ruleName);
}

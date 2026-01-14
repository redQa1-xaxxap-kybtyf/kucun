/**
 * R1: 库存一致性规则（P0）
 *
 * 检查项：
 * 1. inventory.quantity >= 0
 * 2. inventory.reservedQuantity >= 0
 * 3. inventory.reservedQuantity <= inventory.quantity
 */

import { prisma } from '@/lib/db';

import { BaseRule } from './BaseRule';
import {
  RuleSeverity,
  type EntityType,
  type RuleConfig,
  type RuleContext,
  type RuleOutput,
} from './types';

export class InventoryConsistencyRule extends BaseRule {
  readonly ruleName = 'inventory_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R1: 库存一致性',
    description: '检查库存数量和预留数量的有效性',
    severity: RuleSeverity.P0,
    entityType: 'inventory' as EntityType,
    windowMinutes: 15, // 只检查最近 15 分钟内更新的库存
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{entityId}:{code}',
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 查询库存记录（应用增量过滤）
    const inventories = await this.queryWithPagination(
      async (take, skip) =>
        prisma.inventory.findMany({
          where: context.whereFilters ?? {},
          take,
          skip,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            quantity: true,
            reservedQuantity: true,
            updatedAt: true,
          },
        }),
      {
        batchSize: context.batchSize || this.config.batchSize,
        maxRecords: context.maxRecords || this.config.maxRecordsToCheck,
      }
    );

    // 检查规则
    for (const inv of inventories) {
      const issues: string[] = [];

      // 规则 1: quantity >= 0
      if (inv.quantity < 0) {
        issues.push(`quantity=${inv.quantity} < 0`);
      }

      // 规则 2: reservedQuantity >= 0
      if (inv.reservedQuantity < 0) {
        issues.push(`reservedQuantity=${inv.reservedQuantity} < 0`);
      }

      // 规则 3: reservedQuantity <= quantity
      if (inv.reservedQuantity > inv.quantity) {
        issues.push(
          `reservedQuantity(${inv.reservedQuantity}) > quantity(${inv.quantity})`
        );
      }

      if (issues.length > 0) {
        outputs.push(
          this.createOutput('inventory', inv.id, {
            quantity: inv.quantity,
            reservedQuantity: inv.reservedQuantity,
            issues,
            updatedAt: inv.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

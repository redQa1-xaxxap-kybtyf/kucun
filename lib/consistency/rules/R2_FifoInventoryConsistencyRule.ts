/**
 * R2: FIFO 队列与库存数量一致性规则（P1）
 *
 * 检查项：
 * Σ(inventory_cost_queue.remainingQty by productId/variantId/batch) 与 inventory.quantity 对齐
 *
 * 增量扫描：只检查最近有 Outbound/Inbound 更新的 SKU
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

export class FifoInventoryConsistencyRule extends BaseRule {
  readonly ruleName = 'fifo_inventory_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R2: FIFO 队列与库存数量一致性',
    description: '检查 FIFO 队列剩余数量与库存数量是否对齐',
    severity: RuleSeverity.P1,
    entityType: 'inventory' as EntityType,
    windowMinutes: 15, // 只检查最近 15 分钟内更新的 SKU
    checkRecentChangesOnly: true,
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{skuId}:{diffHash}',
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 增量扫描：查找最近有出入库变更的 SKU
    const recentChangesWindow = new Date(
      Date.now() - (this.config.windowMinutes || 15) * 60 * 1000
    );

    const recentChanges = await prisma.$queryRaw<
      Array<{
        sku_id: string;
        product_id: string;
        variant_id: string;
        batch_number: string;
        change_type: string;
        last_updated: Date;
      }>
    >`
      SELECT
        CONCAT(
          IFNULL(product_id, ''),
          '|',
          IFNULL(variant_id, ''),
          '|',
          IFNULL(batch_number, '')
        ) as sku_id,
        product_id,
        variant_id,
        batch_number,
        'outbound' as change_type,
        MAX(updated_at) as last_updated
      FROM outbound_records
      WHERE updated_at >= ${recentChangesWindow}
      GROUP BY product_id, variant_id, batch_number
      
      UNION ALL
      
      SELECT
        CONCAT(
          IFNULL(product_id, ''),
          '|',
          IFNULL(variant_id, ''),
          '|',
          IFNULL(batch_number, '')
        ) as sku_id,
        product_id,
        variant_id,
        batch_number,
        'inbound' as change_type,
        MAX(updated_at) as last_updated
      FROM inbound_records
      WHERE updated_at >= ${recentChangesWindow}
      GROUP BY product_id, variant_id, batch_number
      
      ORDER BY last_updated DESC
      LIMIT ${context.maxRecords || this.config.maxRecordsToCheck}
    `;

    // 为每个 SKU 检查 FIFO 队列总和与库存数量
    for (const change of recentChanges) {
      const fifoSum = await prisma.inventoryCostQueue.aggregate({
        where: {
          productId: change.product_id,
          variantId: change.variant_id,
          batchNumber: change.batch_number,
          remainingQty: { gt: 0 },
        },
        _sum: { remainingQty: true },
      });

      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: change.product_id,
          variantId: change.variant_id,
          batchNumber: change.batch_number,
        },
        select: {
          id: true,
          quantity: true,
          updatedAt: true,
        },
      });

      if (!inventory) {
        // SKU 不存在于库存表中，这可能是正常的（新入库记录尚未同步）
        continue;
      }

      const fifoRemaining = Number(fifoSum._sum.remainingQty || 0);
      const invQuantity = Number(inventory.quantity);

      // 允许小误差（+/- 5% 或 +/- 10）
      const epsilon = Math.max(10, invQuantity * 0.05);

      if (Math.abs(fifoRemaining - invQuantity) > epsilon) {
        outputs.push(
          this.createOutput('inventory', inventory.id, {
            productId: change.product_id,
            variantId: change.variant_id,
            batchNumber: change.batch_number,
            inventoryQuantity: invQuantity,
            fifoQueueSum: fifoRemaining,
            difference: fifoRemaining - invQuantity,
            allowedEpsilon: epsilon,
            lastChangeType: change.change_type,
            lastChangeAt: change.last_updated.toISOString(),
            updatedAt: inventory.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

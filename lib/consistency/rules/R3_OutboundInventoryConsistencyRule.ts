/**
 * R3: 出库与库存扣减对齐规则（P0）
 *
 * 检查项：
 * outboundRecord.totalQty 与 inventory 扣减数量一致
 * 按业务字段计算：quantity + reservedQuantity（如果存在）
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

export class OutboundInventoryConsistencyRule extends BaseRule {
  readonly ruleName = 'outbound_inventory_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R3: 出库与库存扣减对齐',
    description: '检查出库记录与库存扣减数量是否一致',
    severity: RuleSeverity.P0,
    entityType: 'outbound_record' as EntityType,
    windowMinutes: 10, // 只检查最近 10 分钟内更新的出库记录
    checkRecentChangesOnly: true,
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{entityId}:{totalQty}',
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 查询最近更新的出库记录（应用增量过滤）
    const outboundRecords = await this.queryWithPagination(
      async (take, skip) =>
        prisma.outboundRecord.findMany({
          where: context.whereFilters ?? {},
          take,
          skip,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            recordNumber: true,
            productId: true,
            variantId: true,
            batchNumber: true,
            inventoryId: true,
            quantity: true,
            unitCost: true,
            totalCost: true,
            salesOrderId: true,
            reason: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      {
        batchSize: context.batchSize || this.config.batchSize,
        maxRecords: context.maxRecords || this.config.maxRecordsToCheck,
      }
    );

    // 检查每个出库记录
    for (const outbound of outboundRecords) {
      const issues: string[] = [];

      // 获取库存记录
      const inventory = await prisma.inventory.findFirst({
        where: {
          productId: outbound.productId,
          variantId: outbound.variantId,
          batchNumber: outbound.batchNumber,
        },
        select: {
          id: true,
          quantity: true,
          reservedQuantity: true,
          updatedAt: true,
        },
      });

      if (!inventory) {
        issues.push('inventory record not found for outbound');
      } else {
        // 检查出库数量是否在合理范围内
        const outboundQty = outbound.quantity;
        const invQty = Number(inventory.quantity || 0);
        const reservedQty = Number(inventory.reservedQuantity || 0);

        // 业务逻辑：
        // 1. 出库数量不应超过库存总量
        // 2. 出库数量应该等于或小于（库存总量 - 预留量）
        const availableQty = invQty - reservedQty;

        if (outboundQty > invQty) {
          issues.push(
            `outboundQty(${outboundQty}) > inventoryQuantity(${invQty})`
          );
        }

        if (outboundQty > availableQty && reservedQty > 0) {
          issues.push(
            `outboundQty(${outboundQty}) > availableQty(${availableQty}) (reserved: ${reservedQty})`
          );
        }

        // 如果库存总量和预留量都等于 0，但出库记录存在，这是异常
        if (invQty === 0 && reservedQty === 0 && outboundQty > 0) {
          issues.push(
            `inventory is empty (qty=0, reserved=0) but outboundQty=${outboundQty}`
          );
        }
      }

      if (issues.length > 0) {
        outputs.push(
          this.createOutput('outbound_record', outbound.id, {
            recordNumber: outbound.recordNumber,
            productId: outbound.productId,
            variantId: outbound.variantId,
            batchNumber: outbound.batchNumber,
            outboundQuantity: outbound.quantity,
            inventoryQuantity: inventory?.quantity,
            reservedQuantity: inventory?.reservedQuantity,
            issues,
            updatedAt: outbound.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

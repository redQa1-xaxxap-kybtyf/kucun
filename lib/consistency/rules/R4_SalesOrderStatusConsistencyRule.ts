/**
 * R4: 订单状态与副作用一致性规则（P1）
 *
 * 检查项：
 * status=shipped 的订单必须存在 outboundRecord 且成本已回填
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

export class SalesOrderStatusConsistencyRule extends BaseRule {
  readonly ruleName = 'sales_order_status_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R4: 订单状态与副作用一致性',
    description: '检查已发货订单是否有关联的出库记录和成本',
    severity: RuleSeverity.P1,
    entityType: 'sales_order' as EntityType,
    windowMinutes: 10, // 只检查最近 10 分钟内更新的订单
    checkRecentChangesOnly: true,
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{entityId}:{status}',
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 查询已发货的订单（应用增量过滤）
    const shippedOrders = await this.queryWithPagination(
      async (take, skip) =>
        prisma.salesOrder.findMany({
          where: {
            ...(context.whereFilters ?? {}),
            status: 'shipped',
            shippedAt: { not: null },
          },
          take,
          skip,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            itemsAmount: true,
            shippedAt: true,
            costAmount: true,
            updatedAt: true,
            items: {
              select: {
                id: true,
                productId: true,
                variantId: true,
                unitCost: true,
              },
            },
          },
        }),
      {
        batchSize: context.batchSize || this.config.batchSize,
        maxRecords: context.maxRecords || this.config.maxRecordsToCheck,
      }
    );

    // 检查每个已发货订单
    for (const order of shippedOrders) {
      const issues: string[] = [];

      // 检查是否存在出库记录
      const outboundCount = await prisma.outboundRecord.count({
        where: { salesOrderId: order.id },
      });

      if (outboundCount === 0) {
        issues.push(
          `no outbound record found for shipped order (count: ${outboundCount})`
        );
      }

      // 检查成本是否已回填
      if (order.costAmount === null || order.costAmount === undefined) {
        // 检查是否所有明细都有成本
        const itemsWithoutCost = order.items.filter(
          item => item.unitCost === null
        );
        if (itemsWithoutCost.length > 0) {
          issues.push(
            `costAmount is null (${itemsWithoutCost.length}/${order.items.length} items without cost)`
          );
        }
      }

      if (issues.length > 0) {
        outputs.push(
          this.createOutput('sales_order', order.id, {
            orderNumber: order.orderNumber,
            status: order.status,
            shippedAt: order.shippedAt?.toISOString(),
            outboundRecordCount: outboundCount,
            costAmount: order.costAmount,
            itemsCount: order.items.length,
            itemsWithoutCost: order.items.filter(i => i.unitCost === null)
              .length,
            issues,
            updatedAt: order.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

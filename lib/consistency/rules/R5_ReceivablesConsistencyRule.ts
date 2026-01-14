/**
 * R5: 应收口径一致性规则（P1）
 *
 * 检查项：
 * receivables-service 的应收汇总与订单维度推导差异在阈值内
 * 增量：仅检查本窗口内发生 payment/refund/order 更新的 customer/order
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

export class ReceivablesConsistencyRule extends BaseRule {
  readonly ruleName = 'receivables_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R5: 应收口径一致性',
    description: '检查应收汇总与订单维度推导是否一致',
    severity: RuleSeverity.P1,
    entityType: 'account_statement' as EntityType,
    windowMinutes: 10, // 只检查最近 10 分钟内更新的对账单
    checkRecentChangesOnly: true,
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{entityId}:{diffHash}',
    threshold: {
      field: 'differenceAmount',
      operator: 'gt',
      value: 0.01, // 差异超过 0.01 元
    },
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 查询最近更新的对账单（应用增量过滤）
    const statements = await this.queryWithPagination(
      async (take, skip) =>
        prisma.accountStatement.findMany({
          where: context.whereFilters ?? {},
          take,
          skip,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            entityId: true,
            entityName: true,
            partnerRole: true,
            totalOrders: true,
            totalAmount: true,
            paidAmount: true,
            pendingAmount: true,
            currentBalance: true,
            lastTransactionDate: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      {
        batchSize: context.batchSize || this.config.batchSize,
        maxRecords: context.maxRecords || this.config.maxRecordsToCheck,
      }
    );

    // 为每个对账单重新计算应收汇总
    for (const statement of statements) {
      const issues: string[] = [];

      // 获取所有相关的销售订单
      const salesOrders = await prisma.salesOrder.findMany({
        where: {
          customerId: statement.entityId,
          status: { in: ['confirmed', 'completed', 'cancelled'] },
          createdAt: { gte: statement.createdAt },
        },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          totalAmount: true,
          itemsAmount: true,
          paidAmount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // 计算订单维度汇总
      const orderTotal = Number(
        salesOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
      );
      const orderPaid = Number(
        salesOrders.reduce((sum, o) => sum + (Number(o.paidAmount) || 0), 0)
      );
      const orderPending = orderTotal - orderPaid;

      // 对比差异
      const diffAmount = Math.abs(
        Number(statement.pendingAmount) - orderPending
      );

      if (diffAmount > Number(this.config.threshold?.value || 0.01)) {
        issues.push(
          `statement.pendingAmount(${statement.pendingAmount}) != orderPending(${orderPending})`
        );
      }

      // 检查总金额一致性
      const diffTotal = Math.abs(Number(statement.totalAmount) - orderTotal);
      if (diffTotal > 10) {
        // 总金额差异超过 10 元才告警
        issues.push(
          `statement.totalAmount(${statement.totalAmount}) != orderTotal(${orderTotal})`
        );
      }

      if (issues.length > 0) {
        outputs.push(
          this.createOutput('account_statement', statement.id, {
            entityName: statement.entityName,
            partnerRole: statement.partnerRole,
            statementTotalAmount: Number(statement.totalAmount),
            statementPaidAmount: Number(statement.paidAmount),
            statementPendingAmount: Number(statement.pendingAmount),
            orderTotal,
            orderPaid,
            orderPending,
            diffAmount,
            diffTotal,
            issues,
            salesOrderCount: salesOrders.length,
            lastOrderUpdatedAt: salesOrders[0]?.updatedAt?.toISOString(),
            updatedAt: statement.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

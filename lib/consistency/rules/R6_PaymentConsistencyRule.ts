/**
 * R6: 支付状态与应收余额一致性规则（P1）
 *
 * 检查项：
 * payment confirmed/applied 后应收余额更新存在且方向正确
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

export class PaymentConsistencyRule extends BaseRule {
  readonly ruleName = 'payment_consistency';
  readonly supportsIncrementalScan = true;
  config: RuleConfig = {
    name: 'R6: 支付状态与应收余额一致性',
    description: '检查支付后应收余额是否正确更新',
    severity: RuleSeverity.P1,
    entityType: 'payment_record' as EntityType,
    windowMinutes: 10, // 只检查最近 10 分钟内更新的支付记录
    checkRecentChangesOnly: true,
    batchSize: 500,
    maxRecordsToCheck: 5000,
    dedupeKeyTemplate: '{ruleName}:{entityType}:{entityId}:{status}',
  };

  async checkInternal(context: RuleContext): Promise<RuleOutput[]> {
    const outputs: RuleOutput[] = [];

    // 查询最近更新的支付记录（应用增量过滤）
    const payments = await this.queryWithPagination(
      async (take, skip) =>
        prisma.paymentRecord.findMany({
          where: {
            ...(context.whereFilters ?? {}),
            status: { in: ['confirmed', 'applied'] },
          },
          take,
          skip,
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            paymentNumber: true,
            customerId: true,
            paymentType: true,
            paymentAmount: true,
            actualPaymentAmount: true,
            appliedAmount: true,
            status: true,
            paymentDate: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      {
        batchSize: context.batchSize || this.config.batchSize,
        maxRecords: context.maxRecords || this.config.maxRecordsToCheck,
      }
    );

    // 检查每个支付记录
    for (const payment of payments) {
      const issues: string[] = [];

      // 获取支付后的应收余额快照
      const statement = await prisma.accountStatement.findFirst({
        where: {
          entityId: payment.customerId,
          entityName: 'Customer',
        },
        select: {
          id: true,
          currentBalance: true,
          totalAmount: true,
          paidAmount: true,
          lastTransactionDate: true,
          updatedAt: true,
        },
      });

      if (!statement) {
        issues.push('account statement not found');
      } else {
        // 检查余额是否更新
        const balanceUpdated =
          statement.lastTransactionDate &&
          statement.lastTransactionDate >= payment.updatedAt;

        if (!balanceUpdated) {
          issues.push(
            `balance not updated after payment (lastTransaction: ${statement.lastTransactionDate?.toISOString()}, payment.updatedAt: ${payment.updatedAt.toISOString()})`
          );
        }

        // 验证余额更新方向
        if (statement.totalAmount !== null && statement.paidAmount !== null) {
          const calculatedBalance =
            Number(statement.totalAmount) - Number(statement.paidAmount);
          const actualBalance = Number(statement.currentBalance);

          if (Math.abs(calculatedBalance - actualBalance) > 0.01) {
            issues.push(
              `balance mismatch: calculated=${calculatedBalance}, actual=${actualBalance}`
            );
          }
        }
      }

      if (issues.length > 0) {
        outputs.push(
          this.createOutput('payment_record', payment.id, {
            paymentNumber: payment.paymentNumber,
            customerId: payment.customerId,
            paymentType: payment.paymentType,
            paymentAmount: Number(payment.paymentAmount),
            actualPaymentAmount: Number(payment.actualPaymentAmount || 0),
            appliedAmount: Number(payment.appliedAmount || 0),
            status: payment.status,
            paymentDate: payment.paymentDate.toISOString(),
            issues,
            accountStatement: statement
              ? {
                  currentBalance: Number(statement.currentBalance),
                  totalAmount: Number(statement.totalAmount),
                  paidAmount: Number(statement.paidAmount),
                }
              : null,
            updatedAt: payment.updatedAt.toISOString(),
          })
        );
      }
    }

    return outputs;
  }
}

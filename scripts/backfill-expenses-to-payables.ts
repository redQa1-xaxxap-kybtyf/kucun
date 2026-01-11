/**
 * 历史费用回填到应付款脚本
 *
 * 功能：
 * 1. 扫描所有已审批但未关联应付款的费用记录
 * 2. 按照 merge 策略创建/合并应付款
 * 3. 支持 dry-run 模式预览操作
 * 4. 批量处理并生成详细报告
 * 5. 导出 CSV 格式的对账报告
 *
 * 使用方式：
 * - 预览模式：npx tsx scripts/backfill-expenses-to-payables.ts --dry-run
 * - 执行模式：npx tsx scripts/backfill-expenses-to-payables.ts
 * - 指定批次：npx tsx scripts/backfill-expenses-to-payables.ts --batch-size=50
 * - 导出报告：npx tsx scripts/backfill-expenses-to-payables.ts --export-csv
 */

import { createWriteStream } from 'fs';
import { resolve } from 'path';

import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import {
  createOrMergePayableFromExpense,
  type PayableResult,
} from '@/lib/services/expense-payable-integration';

interface BackfillOptions {
  dryRun: boolean;
  batchSize: number;
  exportCsv: boolean;
  continueOnError: boolean;
}

interface BackfillStats {
  totalExpenses: number;
  processed: number;
  created: number;
  merged: number;
  skipped: number;
  failed: number;
  errors: Array<{
    expenseId: string;
    expenseNumber: string;
    error: string;
  }>;
  results: Array<{
    expenseId: string;
    expenseNumber: string;
    expenseAmount: number;
    supplierId: string | null;
    action: 'created' | 'merged' | 'skipped' | 'failed';
    payableId?: string;
    payableNumber?: string;
    error?: string;
  }>;
}

/**
 * 解析命令行参数
 */
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes('--dry-run'),
    batchSize: parseInt(
      args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100'
    ),
    exportCsv: args.includes('--export-csv'),
    continueOnError: args.includes('--continue-on-error'),
  };
}

/**
 * 导出 CSV 报告
 */
async function exportCsvReport(
  stats: BackfillStats,
  _options: BackfillOptions
): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `backfill-report-${timestamp}.csv`;
  const filepath = resolve(process.cwd(), 'claudedocs', filename);

  const csvStream = createWriteStream(filepath, { encoding: 'utf8' });

  // CSV 头部
  csvStream.write(
    '费用ID,费用编号,费用金额,供应商ID,操作结果,应付款ID,应付款编号,错误信息\n'
  );

  // CSV 数据行
  for (const result of stats.results) {
    const row = [
      result.expenseId,
      result.expenseNumber,
      result.expenseAmount.toFixed(2),
      result.supplierId || '',
      result.action,
      result.payableId || '',
      result.payableNumber || '',
      result.error ? `"${result.error.replace(/"/g, '""')}"` : '',
    ].join(',');

    csvStream.write(`${row}\n`);
  }

  csvStream.end();

  return new Promise((resolve, reject) => {
    csvStream.on('finish', () => {
      console.log(`\n📄 CSV 报告已导出: ${filepath}`);
      resolve();
    });
    csvStream.on('error', reject);
  });
}

/**
 * 打印统计摘要
 */
function printSummary(stats: BackfillStats, options: BackfillOptions): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 回填统计摘要');
  console.log('='.repeat(60));
  console.log(
    `模式: ${options.dryRun ? '🔍 预览模式（Dry Run）' : '✅ 执行模式'}`
  );
  console.log(`总费用记录数: ${stats.totalExpenses}`);
  console.log(`已处理: ${stats.processed}`);
  console.log(`  ✅ 创建新应付款: ${stats.created}`);
  console.log(`  🔗 合并到现有应付款: ${stats.merged}`);
  console.log(`  ⏭️  跳过（已关联）: ${stats.skipped}`);
  console.log(`  ❌ 失败: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    stats.errors.forEach((error, index) => {
      console.log(
        `  ${index + 1}. 费用 ${error.expenseNumber} (${error.expenseId}): ${error.error}`
      );
    });
  }

  console.log(`${'='.repeat(60)}\n`);
}

/**
 * 回填单个费用
 */
async function backfillExpense(
  expense: {
    id: string;
    expenseNumber: string;
    expenseAmount: number;
    supplierId: string | null;
    relatedType: string | null;
    relatedId: string | null;
    relatedNumber: string | null;
    userId: string;
  },
  options: BackfillOptions
): Promise<PayableResult | null> {
  if (options.dryRun) {
    // 预览模式：不实际创建，只返回模拟结果
    logger.info('backfill', '【DRY RUN】模拟创建应付款', {
      expenseId: expense.id,
      expenseNumber: expense.expenseNumber,
      supplierId: expense.supplierId,
    });
    return {
      payableId: 'dry-run-id',
      payableNumber: 'DRY-RUN-XXXXX',
      action: 'created',
      newAmount: expense.expenseAmount,
    };
  }

  // 实际执行模式
  return await createOrMergePayableFromExpense({
    expenseId: expense.id,
    expenseNumber: expense.expenseNumber,
    expenseAmount: expense.expenseAmount,
    supplierId: expense.supplierId,
    sourceType:
      (expense.relatedType as
        | 'sales_order'
        | 'factory_shipment'
        | 'purchase_order'
        | 'other') || 'other',
    sourceId: expense.relatedId,
    sourceNumber: expense.relatedNumber,
    userId: expense.userId,
  });
}

/**
 * 主回填函数
 */
async function backfillExpensesToPayables(
  options: BackfillOptions
): Promise<void> {
  console.log('🚀 开始费用回填到应付款...\n');
  console.log(`配置: ${JSON.stringify(options, null, 2)}\n`);

  if (!env.EXPENSE_TO_PAYABLE_ENABLED) {
    console.error('❌ 功能未启用: EXPENSE_TO_PAYABLE_ENABLED=false');
    process.exit(1);
  }

  if (env.EXPENSE_TO_PAYABLE_STRATEGY !== 'merge') {
    console.warn(
      `⚠️  当前策略为 ${env.EXPENSE_TO_PAYABLE_STRATEGY}，建议使用 merge 策略`
    );
  }

  const stats: BackfillStats = {
    totalExpenses: 0,
    processed: 0,
    created: 0,
    merged: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    results: [],
  };

  try {
    const expenseWhere = {
      status: 'approved',
      payableId: null,
      expenseAmount: { gt: 0 },
      supplierId: { not: null },
    } as const;

    stats.totalExpenses = await prisma.expenseRecord.count({
      where: expenseWhere,
    });

    console.log(`📦 找到 ${stats.totalExpenses} 条符合条件的费用记录\n`);

    if (stats.totalExpenses === 0) {
      console.log('✅ 没有需要回填的费用记录');
      return;
    }

    // 批量处理
    const batches = Math.ceil(stats.totalExpenses / options.batchSize);
    let cursor: string | undefined;
    let processed = 0;
    let batchIndex = 0;

    while (true) {
      const currentBatch = await prisma.expenseRecord.findMany({
        where: expenseWhere,
        orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          expenseNumber: true,
          expenseAmount: true,
          supplierId: true,
          relatedType: true,
          relatedId: true,
          relatedNumber: true,
          userId: true,
        },
        take: options.batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      if (currentBatch.length === 0) {
        break;
      }

      batchIndex++;
      const start = processed + 1;
      processed += currentBatch.length;
      const end = processed;
      console.log(
        `\n📦 处理批次 ${batchIndex}/${batches} (${start}-${end}/${stats.totalExpenses})`
      );

      for (const expense of currentBatch) {
        const normalizedExpense = {
          ...expense,
          expenseAmount: Number(expense.expenseAmount ?? 0),
        };
        try {
          const result = await backfillExpense(normalizedExpense, options);

          if (result) {
            stats.processed++;

            if (result.action === 'created') {
              stats.created++;
            } else if (result.action === 'merged') {
              stats.merged++;
            } else if (result.action === 'skipped') {
              stats.skipped++;
            }

            stats.results.push({
              expenseId: normalizedExpense.id,
              expenseNumber: normalizedExpense.expenseNumber,
              expenseAmount: normalizedExpense.expenseAmount,
              supplierId: normalizedExpense.supplierId,
              action: result.action,
              payableId: result.payableId,
              payableNumber: result.payableNumber,
            });

            const actionSymbol =
              result.action === 'created'
                ? '✅'
                : result.action === 'merged'
                  ? '🔗'
                  : '⏭️';
            console.log(
              `  ${actionSymbol} ${normalizedExpense.expenseNumber}: ${result.action} → ${result.payableNumber}`
            );
          }
        } catch (error) {
          stats.failed++;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          stats.errors.push({
            expenseId: normalizedExpense.id,
            expenseNumber: normalizedExpense.expenseNumber,
            error: errorMessage,
          });

          stats.results.push({
            expenseId: normalizedExpense.id,
            expenseNumber: normalizedExpense.expenseNumber,
            expenseAmount: normalizedExpense.expenseAmount,
            supplierId: normalizedExpense.supplierId,
            action: 'failed',
            error: errorMessage,
          });

          console.error(
            `  ❌ ${normalizedExpense.expenseNumber}: 失败 - ${errorMessage}`
          );

          logger.error('backfill', '回填费用失败', error, {
            expenseId: normalizedExpense.id,
            expenseNumber: normalizedExpense.expenseNumber,
          });

          if (!options.continueOnError) {
            throw error;
          }
        }
      }

      cursor = currentBatch[currentBatch.length - 1].id;
    }

    // 打印统计摘要
    printSummary(stats, options);

    // 导出 CSV 报告
    if (options.exportCsv && stats.results.length > 0) {
      await exportCsvReport(stats, options);
    }

    // 验证一致性（仅在实际执行模式下）
    if (!options.dryRun && stats.created + stats.merged > 0) {
      console.log('\n🔍 验证数据一致性...');
      const sampleSize = Math.min(
        30,
        stats.results.filter(r => r.payableId).length
      );
      const sampleResults = stats.results
        .filter(r => r.payableId)
        .sort(() => Math.random() - 0.5)
        .slice(0, sampleSize);

      console.log(`抽样验证 ${sampleSize} 条记录...`);

      let validationErrors = 0;

      for (const result of sampleResults) {
        const expense = await prisma.expenseRecord.findUnique({
          where: { id: result.expenseId },
          select: { payableId: true },
        });

        if (expense?.payableId !== result.payableId) {
          console.error(
            `  ❌ 验证失败: ${result.expenseNumber} 的 payableId 不匹配`
          );
          validationErrors++;
        }
      }

      if (validationErrors === 0) {
        console.log(`  ✅ 抽样验证通过 (${sampleSize}/${sampleSize})`);
      } else {
        console.error(
          `  ❌ 验证失败: ${validationErrors}/${sampleSize} 条记录不一致`
        );
      }
    }
  } catch (error) {
    logger.error('backfill', '回填过程失败', error);
    console.error('\n❌ 回填过程失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 执行脚本
const options = parseArgs();
backfillExpensesToPayables(options)
  .then(() => {
    console.log('\n✅ 回填完成\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ 回填失败:', error);
    process.exit(1);
  });

import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

import { generateBatchNumberOutsideTransaction } from '@/lib/api/batch-number-generator';
import {
  executeMinimalInboundTransaction,
  validateProductExistsOutsideTransaction,
} from '@/lib/api/minimal-inbound-transaction';
import { withAuth } from '@/lib/auth/api-helpers';
import { requirePermission } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  initialStockImportSchema,
  type InitialStockRowInput,
} from '@/lib/validations/initial-stock';

/**
 * POST /api/inventory/initial-stock/import
 * 期初库存 Excel 批量导入
 *
 * - 仅支持 reason = 'opening_balance'
 * - 会应用期初入库的重复/合理性校验
 */
export const POST = withAuth(async (request: NextRequest, context) => {
  try {
    // 权限：期初库存录入
    requirePermission(context.user, 'inventory:opening_balance');

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.startsWith('multipart/form-data')) {
      return NextResponse.json(
        { error: '请求格式错误，必须使用 multipart/form-data 上传 Excel 文件' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: '请上传 Excel 文件（字段名：file）' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return NextResponse.json(
        { error: 'Excel 文件内容为空或格式不正确' },
        { status: 400 }
      );
    }

    // 读取为 JSON，header: 1 则第一行作为表头
    const rawRows = XLSX.utils.sheet_to_json<InitialStockRowInput>(worksheet, {
      defval: '',
    });

    if (!rawRows.length) {
      return NextResponse.json(
        { error: 'Excel 中没有可导入的数据行' },
        { status: 400 }
      );
    }

    // 先做字段级校验（数量、成本等）
    const parsed = initialStockImportSchema.safeParse({ rows: rawRows });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: `数据格式错误: ${issue.message}`,
        },
        { status: 400 }
      );
    }

    const rows = parsed.data.rows;

    // 根据产品编码缓存 productId，减少数据库查询
    const productCache = new Map<string, { id: string; code: string }>();

    let successCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNumber = index + 2; // Excel 行号（假定第1行为表头）

      try {
        const productCode = row.产品编码.trim();
        const batchNumberRaw = row.批次号.trim();

        if (!productCode || !batchNumberRaw) {
          throw new Error('产品编码或批次号不能为空');
        }

        // 1) 根据产品编码查产品
        let product = productCache.get(productCode);
        if (!product) {
          const found = await prisma.product.findUnique({
            where: { code: productCode },
            select: { id: true, code: true },
          });
          if (!found) {
            throw new Error(`产品编码 ${productCode} 不存在`);
          }
          productCache.set(productCode, found);
          product = found;
        }

        // 2) 衍生批次号（保持与单笔入库的批次生成规则一致）
        const productInfo = await validateProductExistsOutsideTransaction(
          product.id
        );
        const finalBatchNumber = await generateBatchNumberOutsideTransaction(
          productInfo,
          batchNumberRaw
        );

        // 3) 期初入库专用校验：不允许重复/与业务数据冲突
        const [
          existingOpeningBalance,
          existingInventory,
          existingBusinessInbound,
        ] = await Promise.all([
          prisma.inboundRecord.findFirst({
            where: {
              productId: product.id,
              variantId: null,
              batchNumber: finalBatchNumber,
              reason: 'opening_balance',
            },
          }),
          prisma.inventory.findFirst({
            where: {
              productId: product.id,
              variantId: null,
              batchNumber: finalBatchNumber,
            },
          }),
          prisma.inboundRecord.findFirst({
            where: {
              productId: product.id,
              variantId: null,
              batchNumber: finalBatchNumber,
              reason: {
                not: 'opening_balance',
              },
            },
          }),
        ]);

        if (existingOpeningBalance) {
          throw new Error(
            `产品 ${productCode} 批次 ${finalBatchNumber} 已有期初库存，如需调整请用“库存调整”`
          );
        }

        if (existingBusinessInbound || existingInventory) {
          throw new Error(
            `产品 ${productCode} 批次 ${finalBatchNumber} 已存在业务入库/库存，不能再作为期初库存`
          );
        }

        // 4) 执行最小入库事务（reason 固定为 opening_balance）
        const quantity = Number(row.数量);
        const unitCost = Number(row.单位成本);

        await executeMinimalInboundTransaction({
          productId: product.id,
          variantId: undefined,
          quantity,
          unitCost,
          reason: 'opening_balance',
          remarks: row.备注 || row.成本来源 || '期初库存导入',
          batchNumber: finalBatchNumber,
          userId: context.user.id,
        });

        successCount += 1;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '未知错误，请检查数据';
        errors.push({ row: rowNumber, message });
      }
    }

    if (errors.length > 0) {
      logger.warn('initial-stock-import', '部分期初库存导入失败', {
        successCount,
        errorCount: errors.length,
      });

      return NextResponse.json(
        {
          success: false,
          successCount,
          errorCount: errors.length,
          errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      successCount,
    });
  } catch (error) {
    logger.error('initial-stock-import', '期初库存导入失败', error);
    return NextResponse.json(
      { error: '期初库存导入失败，请检查文件格式和数据内容' },
      { status: 500 }
    );
  }
});

import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { ZodError } from 'zod';

import {
  importSalesOrdersFromRows,
  validateSalesOrderImportRows,
  type SalesOrderImportExecutionOptions,
  type SalesOrderImportExecutionResult,
  type SalesOrderImportValidationResult,
} from '@/lib/api/handlers/sales-order-import';
import { withAuth } from '@/lib/auth/api-helpers';
import { logger } from '@/lib/logger';
import { parseLocalDateString } from '@/lib/utils/datetime';

function readImportMode(formData: FormData) {
  const mode = String(formData.get('mode') ?? 'dry-run')
    .trim()
    .toLowerCase();

  return mode === 'import' ? 'import' : 'dry-run';
}

function readImportOptions(
  formData: FormData
): SalesOrderImportExecutionOptions {
  const targetStatus = String(formData.get('targetStatus') ?? 'confirmed')
    .trim()
    .toLowerCase();
  const shippedDate = String(formData.get('shippedDate') ?? '').trim();

  if (shippedDate && !parseLocalDateString(shippedDate)) {
    throw new Error('统一发货日期格式不正确，请使用 YYYY-MM-DD');
  }

  return {
    targetStatus: targetStatus === 'shipped' ? 'shipped' : 'confirmed',
    shippedDate: shippedDate || undefined,
  };
}

function isBlobLike(value: unknown): value is Blob {
  return (
    !!value &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    typeof value.arrayBuffer === 'function'
  );
}

function isExecutionResult(
  result: SalesOrderImportValidationResult | SalesOrderImportExecutionResult
): result is SalesOrderImportExecutionResult {
  return (
    typeof (result as SalesOrderImportExecutionResult).importedCount ===
    'number'
  );
}

async function readRowsFromUpload(file: Blob) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    throw new Error('Excel 文件内容为空或格式不正确');
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
    raw: false,
  });
}

function buildResponseMessage(
  mode: 'dry-run' | 'import',
  importOptions: SalesOrderImportExecutionOptions,
  result: SalesOrderImportValidationResult | SalesOrderImportExecutionResult
) {
  const targetLabel =
    importOptions.targetStatus === 'shipped'
      ? '已发货销售订单'
      : '已确认未发货销售订单';
  const autoCreateCustomerText =
    result.autoCreateCustomerNames.length > 0
      ? `，并自动创建 ${result.autoCreateCustomerNames.length} 个客户资料`
      : '';

  if (mode === 'dry-run') {
    if (!result.valid) {
      return result.errorCount > 0
        ? `导入检查完成，共 ${result.errorCount} 条错误，请修正后重试`
        : '没有可导入的销售订单';
    }

    if (result.duplicateOrderCount > 0) {
      return `导入检查完成，可导入 ${result.validOrderCount} 张${targetLabel}${autoCreateCustomerText}，跳过 ${result.duplicateOrderCount} 张重复导入订单`;
    }

    return `导入检查通过，共 ${result.validOrderCount} 张${targetLabel}可导入${autoCreateCustomerText}`;
  }

  if (!isExecutionResult(result)) {
    return '销售记录导入完成';
  }

  if (result.importedCount === 0) {
    if (result.errorCount > 0) {
      return '销售记录导入失败，本次未写入任何订单，请检查错误明细后重试';
    }

    if (result.duplicateOrderCount > 0) {
      return '销售记录导入未执行，本次未写入任何订单，请检查重复订单后重试';
    }

    return '没有可导入的销售订单';
  }

  if (result.duplicateOrderCount > 0) {
    return `成功导入 ${result.importedCount} 张${targetLabel}${autoCreateCustomerText}，跳过 ${result.duplicateOrderCount} 张重复订单`;
  }

  return `成功导入 ${result.importedCount} 张${targetLabel}${autoCreateCustomerText}`;
}

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    try {
      const contentType = request.headers.get('content-type') || '';
      if (!contentType.startsWith('multipart/form-data')) {
        return NextResponse.json(
          {
            success: false,
            error: '请求格式错误，必须使用 multipart/form-data 上传 Excel 文件',
          },
          { status: 400 }
        );
      }

      const formData = await request.formData();
      const file = formData.get('file');

      if (!isBlobLike(file)) {
        return NextResponse.json(
          {
            success: false,
            error: '请上传 Excel 文件（字段名：file）',
          },
          { status: 400 }
        );
      }

      const rows = await readRowsFromUpload(file);
      if (rows.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Excel 中没有可导入的数据行',
          },
          { status: 400 }
        );
      }

      const mode = readImportMode(formData);
      const importOptions = readImportOptions(formData);
      const result =
        mode === 'import'
          ? await importSalesOrdersFromRows(rows, user.id, importOptions)
          : await validateSalesOrderImportRows(rows, importOptions);

      if (
        mode === 'import' &&
        isExecutionResult(result) &&
        result.importedCount > 0
      ) {
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/sales-orders', 'page');
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: buildResponseMessage(mode, importOptions, result),
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const issue = error.issues[0];
        return NextResponse.json(
          {
            success: false,
            error: issue?.message || '导入数据格式不正确',
          },
          { status: 400 }
        );
      }

      logger.error('sales-order-import', '销售记录导入失败', error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : '销售记录导入失败，请检查文件内容后重试',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['sales:manage'] }
);

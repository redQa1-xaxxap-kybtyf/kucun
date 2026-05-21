import { type NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { ZodError } from 'zod';

import {
  importInitialStockRows,
  validateInitialStockImportRows,
  type InitialStockImportExecutionResult,
  type InitialStockImportValidationResult,
} from '@/lib/api/handlers/initial-stock-import';
import { withAuth } from '@/lib/auth/api-helpers';
import { invalidateInventoryCache } from '@/lib/cache/inventory-cache';
import { logger } from '@/lib/logger';
import { type InitialStockRowInput } from '@/lib/validations/initial-stock';

const ACTUAL_BATCH_WEIGHT_HEADER = '本批次实际每件重量(kg)';
const DATE_LIKE_TEXT_HEADERS = new Set(['色号', '批次号']);

function padExcelDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

function formatExcelDateSerial(value: number): string | undefined {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) {
    return undefined;
  }

  return `${parsed.y}-${padExcelDatePart(parsed.m)}-${padExcelDatePart(parsed.d)}`;
}

function getHeaderText(cell: XLSX.CellObject | undefined): string {
  const value = cell?.w ?? cell?.v;
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
}

function normalizeDateLikeTextCells(worksheet: XLSX.WorkSheet) {
  const rangeRef = worksheet['!ref'];
  if (!rangeRef) {
    return;
  }

  const range = XLSX.utils.decode_range(rangeRef);
  const headerRow = range.s.r;

  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const headerAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const header = getHeaderText(worksheet[headerAddress]);

    if (!DATE_LIKE_TEXT_HEADERS.has(header)) {
      continue;
    }

    for (let row = headerRow + 1; row <= range.e.r; row += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[address];

      if (
        !cell ||
        cell.t !== 'n' ||
        typeof cell.v !== 'number' ||
        typeof cell.z !== 'string' ||
        !XLSX.SSF.is_date(cell.z)
      ) {
        continue;
      }

      const formatted = formatExcelDateSerial(cell.v);
      if (!formatted) {
        continue;
      }

      cell.t = 's';
      cell.v = formatted;
      cell.w = formatted;
    }
  }
}

function readImportMode(formData: FormData) {
  const mode = String(formData.get('mode') ?? 'dry-run')
    .trim()
    .toLowerCase();

  return mode === 'import' ? 'import' : 'dry-run';
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
  result: InitialStockImportValidationResult | InitialStockImportExecutionResult
): result is InitialStockImportExecutionResult {
  return (
    typeof (result as InitialStockImportExecutionResult).importedCount ===
    'number'
  );
}

function normalizeInitialStockImportRow(
  row: Record<string, unknown>
): InitialStockRowInput {
  const normalizedRow = { ...row } as Record<string, unknown>;

  if (
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] === undefined &&
    normalizedRow['每件重量(kg)'] !== undefined
  ) {
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] = normalizedRow['每件重量(kg)'];
  }

  if (
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] === undefined &&
    normalizedRow['每件重量'] !== undefined
  ) {
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] = normalizedRow['每件重量'];
  }

  if (
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] === undefined &&
    normalizedRow['本批次实际每件重量'] !== undefined
  ) {
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] =
      normalizedRow['本批次实际每件重量'];
  }

  if (
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] === undefined &&
    normalizedRow['重量(kg)'] !== undefined
  ) {
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] = normalizedRow['重量(kg)'];
  }

  if (
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] === undefined &&
    normalizedRow['重量'] !== undefined
  ) {
    normalizedRow[ACTUAL_BATCH_WEIGHT_HEADER] = normalizedRow['重量'];
  }

  if (
    normalizedRow.数量单位 === undefined &&
    normalizedRow.入库单位 !== undefined
  ) {
    normalizedRow.数量单位 = normalizedRow.入库单位;
  }

  if (
    normalizedRow.数量单位 === undefined &&
    normalizedRow.单位 !== undefined
  ) {
    normalizedRow.数量单位 = normalizedRow.单位;
  }

  if (
    normalizedRow.供应商 === undefined &&
    normalizedRow.供应商名称 !== undefined
  ) {
    normalizedRow.供应商 = normalizedRow.供应商名称;
  }

  if (
    normalizedRow.单位成本 === undefined &&
    normalizedRow.单片成本 !== undefined
  ) {
    normalizedRow.单位成本 = normalizedRow.单片成本;
    normalizedRow.unitCostBasis = 'piece';
  }

  if (
    normalizedRow.单位成本 === undefined &&
    normalizedRow['单片成本(元/片)'] !== undefined
  ) {
    normalizedRow.单位成本 = normalizedRow['单片成本(元/片)'];
    normalizedRow.unitCostBasis = 'piece';
  }

  return normalizedRow as InitialStockRowInput;
}

async function readRowsFromUpload(file: Blob): Promise<InitialStockRowInput[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer', cellNF: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    throw new Error('Excel 文件内容为空或格式不正确');
  }

  normalizeDateLikeTextCells(worksheet);

  return XLSX.utils
    .sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: '',
      raw: false,
    })
    .map(normalizeInitialStockImportRow);
}

function buildResponseMessage(
  mode: 'dry-run' | 'import',
  result: InitialStockImportValidationResult | InitialStockImportExecutionResult
) {
  if (mode === 'dry-run') {
    if (!result.canImport) {
      return result.errorCount > 0
        ? '没有可导入的数据，请先修正错误后重试'
        : '没有可导入的数据';
    }

    if (result.duplicateCount > 0 || result.errorCount > 0) {
      return `导入检查完成，可导入 ${result.validCount} 条，跳过 ${result.duplicateCount} 条，错误 ${result.errorCount} 条`;
    }

    return `导入检查通过，共 ${result.validCount} 条数据可导入`;
  }

  if (!isExecutionResult(result)) {
    return '导入完成';
  }

  if (result.importedCount === 0) {
    return result.canImport
      ? '没有成功导入的数据，请检查错误明细'
      : '没有可导入的数据';
  }

  if (result.duplicateCount > 0 || result.errorCount > 0) {
    return `成功导入 ${result.importedCount} 条，跳过 ${result.duplicateCount} 条，错误 ${result.errorCount} 条`;
  }

  return `成功导入 ${result.importedCount} 条期初库存`;
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
      const result =
        mode === 'import'
          ? await importInitialStockRows(rows, user.id)
          : await validateInitialStockImportRows(rows);

      if (
        mode === 'import' &&
        isExecutionResult(result) &&
        result.importedCount > 0
      ) {
        await Promise.all(
          result.importedProductIds.map(productId =>
            invalidateInventoryCache(productId)
          )
        );

        const { revalidatePath } = await import('next/cache');
        revalidatePath('/inventory', 'page');
        revalidatePath('/inventory/inbound', 'page');
      }

      return NextResponse.json({
        success: true,
        data: result,
        message: buildResponseMessage(mode, result),
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

      logger.error('initial-stock-import', '期初库存批量导入失败', error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : '期初库存导入失败，请检查文件内容后重试',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['inventory:opening_balance'] }
);

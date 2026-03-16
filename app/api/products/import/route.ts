import { NextResponse, type NextRequest } from 'next/server';
import * as XLSX from 'xlsx';
import { ZodError } from 'zod';

import {
  importProductsFromRows,
  validateProductImportRows,
  type ProductImportExecutionResult,
} from '@/lib/api/handlers/product-import';
import { withAuth } from '@/lib/auth/api-helpers';
import { revalidateProducts } from '@/lib/cache';
import { logger } from '@/lib/logger';
import { type ProductImportRowInput } from '@/lib/validations/product-import';

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

async function readRowsFromUpload(
  file: Blob
): Promise<ProductImportRowInput[]> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = sheetName ? workbook.Sheets[sheetName] : undefined;

  if (!worksheet) {
    throw new Error('Excel 文件内容为空或格式不正确');
  }

  return XLSX.utils.sheet_to_json<ProductImportRowInput>(worksheet, {
    defval: '',
    raw: false,
  });
}

function isExecutionResult(
  result:
    | Awaited<ReturnType<typeof validateProductImportRows>>
    | ProductImportExecutionResult
): result is ProductImportExecutionResult {
  return (
    typeof (result as ProductImportExecutionResult).importedCount === 'number'
  );
}

function buildImportMessage(
  result:
    | Awaited<ReturnType<typeof validateProductImportRows>>
    | ProductImportExecutionResult
) {
  if (!result.valid) {
    return '导入未执行，存在校验错误';
  }

  if (!isExecutionResult(result)) {
    return result.duplicateCount > 0
      ? `导入校验完成，可导入 ${result.validCount} 条，重复编码 ${result.duplicateCount} 条将自动跳过`
      : '导入校验完成';
  }

  if (result.duplicateCount > 0) {
    return `成功导入 ${result.importedCount} 个产品，跳过 ${result.duplicateCount} 个重复编码`;
  }

  return `成功导入 ${result.importedCount} 个产品`;
}

export const POST = withAuth(
  async (request: NextRequest) => {
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
          ? await importProductsFromRows(rows)
          : await validateProductImportRows(rows);

      if (
        mode === 'import' &&
        result.valid &&
        isExecutionResult(result) &&
        result.importedCount > 0
      ) {
        const { revalidatePath } = await import('next/cache');
        revalidatePath('/products', 'page');
        await revalidateProducts();
      }

      return NextResponse.json({
        success: true,
        data: result,
        message:
          mode === 'import'
            ? buildImportMessage(result)
            : buildImportMessage(result),
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

      logger.error('product-import', '产品批量导入失败', error);
      return NextResponse.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : '产品批量导入失败，请检查文件内容后重试',
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['products:create'] }
);

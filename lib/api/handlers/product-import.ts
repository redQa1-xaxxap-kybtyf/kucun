import { prisma } from '@/lib/db';
import { productCreateSchema } from '@/lib/validations/product';
import {
  productImportSchema,
  type ProductImportRowInput,
} from '@/lib/validations/product-import';

import {
  createProductRecordInTransaction,
  mapCreatedProductsSummary,
  type ProductCreateData,
} from './product-create';

export interface ProductImportError {
  row: number;
  productCode?: string;
  field?: string;
  message: string;
}

export interface ProductImportDuplicate {
  row: number;
  productCode?: string;
  source: 'file' | 'system';
  message: string;
}

export interface ProductImportPreviewRow {
  row: number;
  code: string;
  name: string;
  specification: string;
  categoryCode: string;
  categoryName: string;
  thickness?: number;
  status: 'active' | 'inactive';
}

interface PreparedProductImportRow {
  rowNumber: number;
  payload: ProductCreateData;
  preview: ProductImportPreviewRow;
}

export interface ProductImportValidationResult {
  valid: boolean;
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  previewRows: ProductImportPreviewRow[];
  duplicates: ProductImportDuplicate[];
  errors: ProductImportError[];
}

export interface ProductImportExecutionResult
  extends ProductImportValidationResult {
  importedCount: number;
  importedProducts: Array<{
    id: string;
    code: string;
    name: string;
    specification?: string;
    status: 'active' | 'inactive';
  }>;
}

type CategoryLookup = {
  id: string;
  code: string;
  name: string;
  status: string;
};

function normalizeStatus(input: string | undefined): 'active' | 'inactive' {
  const value = input?.trim();

  if (!value) {
    return 'active';
  }

  if (['active', '启用'].includes(value)) {
    return 'active';
  }

  if (['inactive', '停用'].includes(value)) {
    return 'inactive';
  }

  throw new Error('状态仅支持 active、inactive、启用、停用');
}

function createImportError(
  row: number,
  message: string,
  field?: string,
  productCode?: string
): ProductImportError {
  return {
    row,
    field,
    message,
    ...(productCode ? { productCode } : {}),
  };
}

function createImportDuplicate(
  row: number,
  source: 'file' | 'system',
  message: string,
  productCode?: string
): ProductImportDuplicate {
  return {
    row,
    source,
    message,
    ...(productCode ? { productCode } : {}),
  };
}

async function loadImportContext(rows: ProductImportRowInput[]) {
  const productCodes = rows.map(row => String(row.产品编码 ?? '').trim());
  const categoryCodes = Array.from(
    new Set(
      rows
        .map(row => String(row.分类编码 ?? '').trim())
        .filter(categoryCode => categoryCode.length > 0)
    )
  );

  const [existingProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where: { code: { in: productCodes } },
      select: { code: true },
    }),
    categoryCodes.length
      ? prisma.category.findMany({
          where: { code: { in: categoryCodes } },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        })
      : Promise.resolve([] as CategoryLookup[]),
  ]);

  return {
    existingCodes: new Set(existingProducts.map(product => product.code)),
    categoryByCode: new Map(
      categories.map(category => [category.code, category])
    ),
  };
}

function buildCreatePayload(
  row: ProductImportRowInput,
  category: CategoryLookup | undefined
): ProductCreateData {
  const status = normalizeStatus(
    typeof row.状态 === 'string' ? row.状态 : undefined
  );
  const thicknessValue = row['厚度(mm)'];
  const thickness =
    typeof thicknessValue === 'number'
      ? thicknessValue
      : typeof thicknessValue === 'string' && thicknessValue.trim()
        ? Number(thicknessValue.trim())
        : undefined;

  return {
    code: String(row.产品编码).trim(),
    name: String(row.产品名称).trim(),
    specification: String(row.规格).trim(),
    description:
      typeof row.描述 === 'string' && row.描述.trim() ? row.描述.trim() : '',
    thickness,
    status,
    categoryId: category?.id ?? 'uncategorized',
    thumbnailUrl: '',
    images: undefined,
  };
}

function buildPreviewRow(
  rowNumber: number,
  row: ProductImportRowInput,
  payload: ProductCreateData,
  category: CategoryLookup | undefined
): ProductImportPreviewRow {
  return {
    row: rowNumber,
    code: payload.code,
    name: payload.name,
    specification: payload.specification,
    categoryCode: typeof row.分类编码 === 'string' ? row.分类编码.trim() : '',
    categoryName: category?.name ?? '无分类',
    ...(typeof payload.thickness === 'number'
      ? { thickness: payload.thickness }
      : {}),
    status: (payload.status ?? 'active') as 'active' | 'inactive',
  };
}

async function prepareProductImportRows(rows: ProductImportRowInput[]) {
  const parsed = productImportSchema.parse({ rows });
  const context = await loadImportContext(parsed.rows);

  const preparedRows: PreparedProductImportRow[] = [];
  const duplicates: ProductImportDuplicate[] = [];
  const errors: ProductImportError[] = [];
  const seenCodes = new Map<string, number>();

  parsed.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const productCode = String(row.产品编码 ?? '').trim();
    const categoryCode =
      typeof row.分类编码 === 'string' ? row.分类编码.trim() : '';

    const firstSeenRow = seenCodes.get(productCode);
    if (firstSeenRow !== undefined) {
      duplicates.push(
        createImportDuplicate(
          rowNumber,
          'file',
          `产品编码与第 ${firstSeenRow} 行重复`,
          productCode
        )
      );
      return;
    }
    seenCodes.set(productCode, rowNumber);

    if (context.existingCodes.has(productCode)) {
      duplicates.push(
        createImportDuplicate(
          rowNumber,
          'system',
          '产品编码已存在，导入时将自动跳过',
          productCode
        )
      );
      return;
    }

    const category = categoryCode
      ? context.categoryByCode.get(categoryCode)
      : undefined;

    if (categoryCode && !category) {
      errors.push(
        createImportError(rowNumber, '分类编码不存在', '分类编码', productCode)
      );
      return;
    }

    if (category && category.status.toLowerCase() !== 'active') {
      errors.push(
        createImportError(
          rowNumber,
          '分类已停用，不能导入到该分类',
          '分类编码',
          productCode
        )
      );
      return;
    }

    let payload: ProductCreateData;
    try {
      payload = buildCreatePayload(row, category);
    } catch (error) {
      errors.push(
        createImportError(
          rowNumber,
          error instanceof Error ? error.message : '状态格式不正确',
          '状态',
          productCode
        )
      );
      return;
    }

    const validationResult = productCreateSchema.safeParse(payload);
    if (!validationResult.success) {
      const firstIssue = validationResult.error.issues[0];
      errors.push(
        createImportError(
          rowNumber,
          firstIssue?.message || '产品数据格式不正确',
          typeof firstIssue?.path[0] === 'string'
            ? String(firstIssue.path[0])
            : undefined,
          productCode
        )
      );
      return;
    }

    preparedRows.push({
      rowNumber,
      payload: validationResult.data,
      preview: buildPreviewRow(rowNumber, row, validationResult.data, category),
    });
  });

  return {
    preparedRows,
    duplicates,
    errors,
    totalCount: parsed.rows.length,
  };
}

export async function validateProductImportRows(
  rows: ProductImportRowInput[]
): Promise<ProductImportValidationResult> {
  const { preparedRows, duplicates, errors, totalCount } =
    await prepareProductImportRows(rows);

  return {
    valid: errors.length === 0,
    totalCount,
    validCount: preparedRows.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    previewRows: preparedRows.map(row => row.preview),
    duplicates,
    errors,
  };
}

export async function importProductsFromRows(
  rows: ProductImportRowInput[]
): Promise<ProductImportExecutionResult> {
  const { preparedRows, duplicates, errors, totalCount } =
    await prepareProductImportRows(rows);

  if (errors.length > 0) {
    return {
      valid: false,
      totalCount,
      validCount: preparedRows.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      previewRows: preparedRows.map(row => row.preview),
      duplicates,
      errors,
      importedCount: 0,
      importedProducts: [],
    };
  }

  const createdProducts = await prisma.$transaction(async tx => {
    const created = [];

    for (const row of preparedRows) {
      created.push(await createProductRecordInTransaction(tx, row.payload));
    }

    return created;
  });

  return {
    valid: true,
    totalCount,
    validCount: preparedRows.length,
    duplicateCount: duplicates.length,
    errorCount: 0,
    previewRows: preparedRows.map(row => row.preview),
    duplicates,
    errors: [],
    importedCount: createdProducts.length,
    importedProducts: mapCreatedProductsSummary(createdProducts),
  };
}

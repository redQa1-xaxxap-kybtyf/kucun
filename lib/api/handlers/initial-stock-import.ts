import { generateBatchNumberOutsideTransaction } from '@/lib/api/batch-number-generator';
import { executeMinimalInboundTransaction } from '@/lib/api/minimal-inbound-transaction';
import { prisma } from '@/lib/db';
import {
  initialStockImportSchema,
  initialStockRowSchema,
  type InitialStockRow,
  type InitialStockRowInput,
} from '@/lib/validations/initial-stock';

export interface InitialStockImportError {
  row: number;
  productCode?: string;
  field?: string;
  message: string;
}

export interface InitialStockImportDuplicate {
  row: number;
  productCode?: string;
  batchNumber?: string;
  source: 'file' | 'opening_balance' | 'inventory' | 'business_inbound';
  message: string;
}

export interface InitialStockImportPreviewRow {
  row: number;
  productCode: string;
  productName: string;
  specification: string;
  colorCode?: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  location?: string;
  matchMethod: string;
}

export interface InitialStockImportValidationResult {
  valid: boolean;
  canImport: boolean;
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  previewRows: InitialStockImportPreviewRow[];
  duplicates: InitialStockImportDuplicate[];
  errors: InitialStockImportError[];
}

export interface InitialStockImportExecutionResult
  extends InitialStockImportValidationResult {
  importedCount: number;
  importedProductIds: string[];
}

type ProductLookup = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  variants: Array<{
    id: string;
    colorCode: string;
    status: string;
  }>;
};

type ParsedInitialStockRow = {
  rowNumber: number;
  row: InitialStockRow;
};

type PreparedInitialStockRow = {
  rowNumber: number;
  product: ProductLookup;
  variantId?: string;
  batchNumber: string;
  quantity: number;
  unitCost: number;
  location?: string;
  remarks: string;
  preview: InitialStockImportPreviewRow;
};

type InitialStockImportContext = {
  productByCode: Map<string, ProductLookup>;
  productsByNameSpec: Map<string, ProductLookup[]>;
};

function normalizeLookupKey(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildNameSpecKey(name: string, specification: string) {
  return `${normalizeLookupKey(name)}::${normalizeLookupKey(specification)}`;
}

function buildResolvedRowKey(
  productId: string,
  variantId: string | undefined,
  batchNumber: string
) {
  return `${productId}::${variantId ?? 'null'}::${normalizeLookupKey(batchNumber)}`;
}

function createImportError(
  row: number,
  message: string,
  field?: string,
  productCode?: string
): InitialStockImportError {
  return {
    row,
    field,
    message,
    ...(productCode ? { productCode } : {}),
  };
}

function createImportDuplicate(
  row: number,
  source: InitialStockImportDuplicate['source'],
  message: string,
  options?: { productCode?: string; batchNumber?: string }
): InitialStockImportDuplicate {
  return {
    row,
    source,
    message,
    ...(options?.productCode ? { productCode: options.productCode } : {}),
    ...(options?.batchNumber ? { batchNumber: options.batchNumber } : {}),
  };
}

async function loadImportContext(
  rows: ParsedInitialStockRow[]
): Promise<InitialStockImportContext> {
  const productCodes = Array.from(
    new Set(
      rows
        .map(item => item.row.产品编码.trim())
        .filter(Boolean)
        .map(code => code.trim())
    )
  );
  const productNames = Array.from(
    new Set(
      rows
        .map(item => item.row.产品名称.trim())
        .filter(Boolean)
        .map(name => name.trim())
    )
  );

  const whereClauses: Array<{
    code?: {
      in: string[];
    };
    name?: {
      in: string[];
    };
  }> = [];

  if (productCodes.length > 0) {
    whereClauses.push({
      code: {
        in: productCodes,
      },
    });
  }

  if (productNames.length > 0) {
    whereClauses.push({
      name: {
        in: productNames,
      },
    });
  }

  const products = await prisma.product.findMany({
    where: whereClauses.length > 0 ? { OR: whereClauses } : undefined,
    select: {
      id: true,
      code: true,
      name: true,
      specification: true,
      variants: {
        select: {
          id: true,
          colorCode: true,
          status: true,
        },
        orderBy: {
          colorCode: 'asc',
        },
      },
    },
  });

  const productByCode = new Map<string, ProductLookup>();
  const productsByNameSpec = new Map<string, ProductLookup[]>();

  products.forEach(product => {
    productByCode.set(normalizeLookupKey(product.code), product);

    const key = buildNameSpecKey(product.name, product.specification ?? '');
    const current = productsByNameSpec.get(key) ?? [];
    current.push(product);
    productsByNameSpec.set(key, current);
  });

  return {
    productByCode,
    productsByNameSpec,
  };
}

function resolveProduct(
  parsedRow: ParsedInitialStockRow,
  context: InitialStockImportContext
):
  | {
      product: ProductLookup;
      matchMethod: string;
    }
  | {
      error: InitialStockImportError;
    } {
  const { rowNumber, row } = parsedRow;
  const productCode = row.产品编码.trim();
  const productName = row.产品名称.trim();
  const specification = row.规格.trim();
  const colorCode = row.色号.trim();

  if (productCode) {
    const product = context.productByCode.get(normalizeLookupKey(productCode));

    if (!product) {
      return {
        error: createImportError(
          rowNumber,
          `产品编码 ${productCode} 不存在，请先在产品管理中创建该产品`,
          '产品编码',
          productCode
        ),
      };
    }

    if (
      productName &&
      normalizeLookupKey(productName) !== normalizeLookupKey(product.name)
    ) {
      return {
        error: createImportError(
          rowNumber,
          '产品编码与产品名称不一致，请核对后重试',
          '产品名称',
          product.code
        ),
      };
    }

    if (
      specification &&
      normalizeLookupKey(specification) !==
        normalizeLookupKey(product.specification ?? '')
    ) {
      return {
        error: createImportError(
          rowNumber,
          '产品编码与规格不一致，请核对后重试',
          '规格',
          product.code
        ),
      };
    }

    return {
      product,
      matchMethod: '产品编码',
    };
  }

  const key = buildNameSpecKey(productName, specification);
  const matches = context.productsByNameSpec.get(key) ?? [];

  if (matches.length === 0) {
    return {
      error: createImportError(
        rowNumber,
        '产品库中不存在名称和规格完全一致的产品，请先在产品管理中创建，或下载产品库模板填写',
        '产品名称'
      ),
    };
  }

  if (matches.length === 1) {
    return {
      product: matches[0],
      matchMethod: '名称+规格',
    };
  }

  if (colorCode) {
    const matchedByColor = matches.filter(product =>
      product.variants.some(
        variant =>
          normalizeLookupKey(variant.colorCode) ===
          normalizeLookupKey(colorCode)
      )
    );

    if (matchedByColor.length === 1) {
      return {
        product: matchedByColor[0],
        matchMethod: '名称+规格+色号',
      };
    }
  }

  return {
    error: createImportError(
      rowNumber,
      '存在多个同名同规格产品，请填写产品编码，或使用“导出产品库模板”后再导入',
      '产品编码'
    ),
  };
}

function resolveVariant(
  parsedRow: ParsedInitialStockRow,
  product: ProductLookup,
  baseMatchMethod: string
):
  | {
      variantId?: string;
      colorCode?: string;
      matchMethod: string;
    }
  | {
      error: InitialStockImportError;
    } {
  const colorCodeInput = parsedRow.row.色号.trim();
  const activeVariants = product.variants.filter(
    variant => variant.status.toLowerCase() === 'active'
  );

  if (!colorCodeInput) {
    if (product.variants.length === 0) {
      return {
        variantId: undefined,
        colorCode: undefined,
        matchMethod: baseMatchMethod,
      };
    }

    if (activeVariants.length === 0) {
      return {
        error: createImportError(
          parsedRow.rowNumber,
          '该产品的色号均已停用，请先在产品管理中启用后再导入',
          '色号',
          product.code
        ),
      };
    }

    if (activeVariants.length === 1) {
      return {
        variantId: activeVariants[0].id,
        colorCode: activeVariants[0].colorCode,
        matchMethod: `${baseMatchMethod} + 自动识别唯一色号`,
      };
    }

    return {
      error: createImportError(
        parsedRow.rowNumber,
        '该产品存在多个色号，请填写色号后再导入',
        '色号',
        product.code
      ),
    };
  }

  if (product.variants.length === 0) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        '该产品未维护色号，不需要填写色号',
        '色号',
        product.code
      ),
    };
  }

  const variant = product.variants.find(
    item =>
      normalizeLookupKey(item.colorCode) === normalizeLookupKey(colorCodeInput)
  );

  if (!variant) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        `色号 ${colorCodeInput} 不存在，请先在产品管理中维护`,
        '色号',
        product.code
      ),
    };
  }

  if (variant.status.toLowerCase() !== 'active') {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        `色号 ${variant.colorCode} 已停用，不能用于期初库存导入`,
        '色号',
        product.code
      ),
    };
  }

  return {
    variantId: variant.id,
    colorCode: variant.colorCode,
    matchMethod: baseMatchMethod,
  };
}

async function parseInitialStockRows(rows: InitialStockRowInput[]): Promise<{
  parsedRows: ParsedInitialStockRow[];
  errors: InitialStockImportError[];
  totalCount: number;
}> {
  initialStockImportSchema.parse({ rows });

  const parsedRows: ParsedInitialStockRow[] = [];
  const errors: InitialStockImportError[] = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const parseResult = initialStockRowSchema.safeParse(rawRow);

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const productCode =
        rawRow && typeof rawRow === 'object' && '产品编码' in rawRow
          ? String((rawRow as Record<string, unknown>).产品编码 ?? '').trim()
          : undefined;

      errors.push(
        createImportError(
          rowNumber,
          issue?.message || '数据格式不正确',
          typeof issue?.path[0] === 'string'
            ? String(issue.path[0])
            : undefined,
          productCode || undefined
        )
      );
      return;
    }

    parsedRows.push({
      rowNumber,
      row: parseResult.data,
    });
  });

  return {
    parsedRows,
    errors,
    totalCount: rows.length,
  };
}

async function filterExistingConflicts(
  rows: PreparedInitialStockRow[]
): Promise<{
  importableRows: PreparedInitialStockRow[];
  duplicates: InitialStockImportDuplicate[];
}> {
  if (rows.length === 0) {
    return {
      importableRows: [],
      duplicates: [],
    };
  }

  const productIds = Array.from(new Set(rows.map(row => row.product.id)));
  const batchNumbers = Array.from(new Set(rows.map(row => row.batchNumber)));

  const [openingBalances, inventories, businessInbounds] = await Promise.all([
    prisma.inboundRecord.findMany({
      where: {
        productId: {
          in: productIds,
        },
        batchNumber: {
          in: batchNumbers,
        },
        reason: 'opening_balance',
      },
      select: {
        productId: true,
        variantId: true,
        batchNumber: true,
      },
    }),
    prisma.inventory.findMany({
      where: {
        productId: {
          in: productIds,
        },
        batchNumber: {
          in: batchNumbers,
        },
      },
      select: {
        productId: true,
        variantId: true,
        batchNumber: true,
      },
    }),
    prisma.inboundRecord.findMany({
      where: {
        productId: {
          in: productIds,
        },
        batchNumber: {
          in: batchNumbers,
        },
        reason: {
          not: 'opening_balance',
        },
      },
      select: {
        productId: true,
        variantId: true,
        batchNumber: true,
      },
    }),
  ]);

  const openingBalanceKeys = new Set(
    openingBalances.map(row =>
      buildResolvedRowKey(
        row.productId,
        row.variantId ?? undefined,
        row.batchNumber ?? ''
      )
    )
  );
  const inventoryKeys = new Set(
    inventories.map(row =>
      buildResolvedRowKey(
        row.productId,
        row.variantId ?? undefined,
        row.batchNumber ?? ''
      )
    )
  );
  const businessInboundKeys = new Set(
    businessInbounds.map(row =>
      buildResolvedRowKey(
        row.productId,
        row.variantId ?? undefined,
        row.batchNumber ?? ''
      )
    )
  );

  const importableRows: PreparedInitialStockRow[] = [];
  const duplicates: InitialStockImportDuplicate[] = [];

  rows.forEach(row => {
    const key = buildResolvedRowKey(
      row.product.id,
      row.variantId,
      row.batchNumber
    );

    if (openingBalanceKeys.has(key)) {
      duplicates.push(
        createImportDuplicate(
          row.rowNumber,
          'opening_balance',
          `产品 ${row.product.code} 批次 ${row.batchNumber} 已有期初库存，本次将自动跳过`,
          {
            productCode: row.product.code,
            batchNumber: row.batchNumber,
          }
        )
      );
      return;
    }

    if (businessInboundKeys.has(key)) {
      duplicates.push(
        createImportDuplicate(
          row.rowNumber,
          'business_inbound',
          `产品 ${row.product.code} 批次 ${row.batchNumber} 已存在业务入库，本次将自动跳过`,
          {
            productCode: row.product.code,
            batchNumber: row.batchNumber,
          }
        )
      );
      return;
    }

    if (inventoryKeys.has(key)) {
      duplicates.push(
        createImportDuplicate(
          row.rowNumber,
          'inventory',
          `产品 ${row.product.code} 批次 ${row.batchNumber} 已存在库存记录，本次将自动跳过`,
          {
            productCode: row.product.code,
            batchNumber: row.batchNumber,
          }
        )
      );
      return;
    }

    importableRows.push(row);
  });

  return {
    importableRows,
    duplicates,
  };
}

async function prepareInitialStockImportRows(rows: InitialStockRowInput[]) {
  const {
    parsedRows,
    errors: parseErrors,
    totalCount,
  } = await parseInitialStockRows(rows);

  if (parsedRows.length === 0) {
    return {
      importableRows: [] as PreparedInitialStockRow[],
      duplicates: [] as InitialStockImportDuplicate[],
      errors: parseErrors,
      totalCount,
    };
  }

  const context = await loadImportContext(parsedRows);
  const seenRowKeys = new Map<string, number>();
  const preliminaryRows: PreparedInitialStockRow[] = [];
  const errors = [...parseErrors];
  const duplicates: InitialStockImportDuplicate[] = [];

  for (const parsedRow of parsedRows) {
    const productResolution = resolveProduct(parsedRow, context);
    if ('error' in productResolution) {
      errors.push(productResolution.error);
      continue;
    }

    const variantResolution = resolveVariant(
      parsedRow,
      productResolution.product,
      productResolution.matchMethod
    );
    if ('error' in variantResolution) {
      errors.push(variantResolution.error);
      continue;
    }

    const finalBatchNumber = await generateBatchNumberOutsideTransaction(
      {
        id: productResolution.product.id,
        code: productResolution.product.code,
      },
      parsedRow.row.批次号.trim()
    );

    const rowKey = buildResolvedRowKey(
      productResolution.product.id,
      variantResolution.variantId,
      finalBatchNumber
    );
    const firstSeenRow = seenRowKeys.get(rowKey);

    if (firstSeenRow !== undefined) {
      duplicates.push(
        createImportDuplicate(
          parsedRow.rowNumber,
          'file',
          `与第 ${firstSeenRow} 行的产品/色号/批次重复，本次将自动跳过`,
          {
            productCode: productResolution.product.code,
            batchNumber: finalBatchNumber,
          }
        )
      );
      continue;
    }

    seenRowKeys.set(rowKey, parsedRow.rowNumber);

    preliminaryRows.push({
      rowNumber: parsedRow.rowNumber,
      product: productResolution.product,
      variantId: variantResolution.variantId,
      batchNumber: finalBatchNumber,
      quantity: parsedRow.row.数量,
      unitCost: parsedRow.row.单位成本,
      location: parsedRow.row.库位 || undefined,
      remarks: parsedRow.row.备注 || parsedRow.row.成本来源 || '期初库存导入',
      preview: {
        row: parsedRow.rowNumber,
        productCode: productResolution.product.code,
        productName: productResolution.product.name,
        specification: productResolution.product.specification ?? '',
        colorCode: variantResolution.colorCode,
        batchNumber: finalBatchNumber,
        quantity: parsedRow.row.数量,
        unitCost: parsedRow.row.单位成本,
        location: parsedRow.row.库位 || undefined,
        matchMethod: variantResolution.matchMethod,
      },
    });
  }

  const { importableRows, duplicates: systemDuplicates } =
    await filterExistingConflicts(preliminaryRows);

  return {
    importableRows,
    duplicates: [...duplicates, ...systemDuplicates],
    errors,
    totalCount,
  };
}

export async function validateInitialStockImportRows(
  rows: InitialStockRowInput[]
): Promise<InitialStockImportValidationResult> {
  const { importableRows, duplicates, errors, totalCount } =
    await prepareInitialStockImportRows(rows);

  return {
    valid: errors.length === 0,
    canImport: importableRows.length > 0,
    totalCount,
    validCount: importableRows.length,
    duplicateCount: duplicates.length,
    errorCount: errors.length,
    previewRows: importableRows.map(row => row.preview),
    duplicates,
    errors,
  };
}

export async function importInitialStockRows(
  rows: InitialStockRowInput[],
  userId: string
): Promise<InitialStockImportExecutionResult> {
  const { importableRows, duplicates, errors, totalCount } =
    await prepareInitialStockImportRows(rows);

  const runtimeErrors = [...errors];
  const importedProductIds: string[] = [];
  let importedCount = 0;

  for (const row of importableRows) {
    try {
      await executeMinimalInboundTransaction({
        productId: row.product.id,
        variantId: row.variantId,
        quantity: row.quantity,
        unitCost: row.unitCost,
        reason: 'opening_balance',
        remarks: row.remarks,
        batchNumber: row.batchNumber,
        location: row.location,
        userId,
      });

      importedCount += 1;
      importedProductIds.push(row.product.id);
    } catch (error) {
      runtimeErrors.push(
        createImportError(
          row.rowNumber,
          error instanceof Error ? error.message : '导入失败，请稍后重试',
          undefined,
          row.product.code
        )
      );
    }
  }

  return {
    valid: runtimeErrors.length === 0,
    canImport: importableRows.length > 0,
    totalCount,
    validCount: importableRows.length,
    duplicateCount: duplicates.length,
    errorCount: runtimeErrors.length,
    previewRows: importableRows.map(row => row.preview),
    duplicates,
    errors: runtimeErrors,
    importedCount,
    importedProductIds: Array.from(new Set(importedProductIds)),
  };
}

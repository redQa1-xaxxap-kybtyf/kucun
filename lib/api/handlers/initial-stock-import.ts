import { randomBytes } from 'node:crypto';

import { generateBatchNumberOutsideTransaction } from '@/lib/api/batch-number-generator';
import { executeMinimalInboundTransaction } from '@/lib/api/minimal-inbound-transaction';
import { prisma } from '@/lib/db';
import { roundCostPrice } from '@/lib/utils/cost-price';
import {
  initialStockImportSchema,
  initialStockRowSchema,
  type InitialStockQuantityUnit,
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
  inputQuantity: number;
  quantityUnit: InitialStockQuantityUnit;
  quantityUnitSource: 'row' | 'default';
  piecesPerUnit?: number;
  piecesPerUnitSource?: 'row';
  weight?: number;
  weightSource?: 'row';
  quantity: number;
  unitCost: number;
  supplierName?: string;
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
  importBatchId?: string;
}

type ProductLookup = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  piecesPerUnit?: number | null;
  variants: Array<{
    id: string;
    colorCode: string;
    status: string;
  }>;
};

type SupplierLookup = {
  id: string;
  name: string;
  supplierCode: string | null;
  status: string;
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
  inputQuantity: number;
  quantityUnit: InitialStockQuantityUnit;
  quantityUnitSource: 'row' | 'default';
  piecesPerUnit?: number;
  piecesPerUnitSource?: 'row';
  batchPiecesPerUnit?: number;
  weight?: number;
  weightSource?: 'row';
  quantity: number;
  unitCost: number;
  supplierId?: string;
  supplierName?: string;
  location?: string;
  remarks: string;
  preview: InitialStockImportPreviewRow;
};

type InitialStockImportContext = {
  productByCode: Map<string, ProductLookup>;
  productsByNameSpec: Map<string, ProductLookup[]>;
  suppliersByName: Map<string, SupplierLookup[]>;
  supplierByCode: Map<string, SupplierLookup>;
};

function normalizeInitialStockRowAliases(
  row: InitialStockRowInput
): InitialStockRowInput {
  const normalizedRow = { ...(row as Record<string, unknown>) };

  if (
    normalizedRow['本批次实际每件重量(kg)'] === undefined &&
    normalizedRow['每件重量(kg)'] !== undefined
  ) {
    normalizedRow['本批次实际每件重量(kg)'] = normalizedRow['每件重量(kg)'];
  }

  if (
    normalizedRow['本批次实际每件重量(kg)'] === undefined &&
    normalizedRow['每件重量'] !== undefined
  ) {
    normalizedRow['本批次实际每件重量(kg)'] = normalizedRow['每件重量'];
  }

  if (
    normalizedRow['本批次实际每件重量(kg)'] === undefined &&
    normalizedRow['重量(kg)'] !== undefined
  ) {
    normalizedRow['本批次实际每件重量(kg)'] = normalizedRow['重量(kg)'];
  }

  if (
    normalizedRow['本批次实际每件重量(kg)'] === undefined &&
    normalizedRow['重量'] !== undefined
  ) {
    normalizedRow['本批次实际每件重量(kg)'] = normalizedRow['重量'];
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

function createOpeningImportBatchId() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const randomPart = randomBytes(2).toString('hex').toUpperCase();
  return `OBI-${datePart}-${timePart}-${randomPart}`;
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
  const supplierInputs = Array.from(
    new Set(
      rows
        .map(item => item.row.供应商.trim())
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

  const [products, suppliers] = await Promise.all([
    prisma.product.findMany({
      where: whereClauses.length > 0 ? { OR: whereClauses } : undefined,
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        piecesPerUnit: true,
        weight: true,
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
    }),
    supplierInputs.length > 0
      ? prisma.supplier.findMany({
          where: {
            OR: [
              {
                name: {
                  in: supplierInputs,
                },
              },
              {
                supplierCode: {
                  in: supplierInputs,
                },
              },
            ],
          },
          select: {
            id: true,
            name: true,
            supplierCode: true,
            status: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const productByCode = new Map<string, ProductLookup>();
  const productsByNameSpec = new Map<string, ProductLookup[]>();
  const suppliersByName = new Map<string, SupplierLookup[]>();
  const supplierByCode = new Map<string, SupplierLookup>();

  products.forEach(product => {
    productByCode.set(normalizeLookupKey(product.code), product);

    const key = buildNameSpecKey(product.name, product.specification ?? '');
    const current = productsByNameSpec.get(key) ?? [];
    current.push(product);
    productsByNameSpec.set(key, current);
  });
  suppliers.forEach(supplier => {
    const normalizedName = normalizeLookupKey(supplier.name);
    const current = suppliersByName.get(normalizedName) ?? [];
    current.push(supplier);
    suppliersByName.set(normalizedName, current);

    if (supplier.supplierCode) {
      supplierByCode.set(normalizeLookupKey(supplier.supplierCode), supplier);
    }
  });

  return {
    productByCode,
    productsByNameSpec,
    suppliersByName,
    supplierByCode,
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

function resolvePiecesPerUnit(
  parsedRow: ParsedInitialStockRow,
  _product: ProductLookup
) {
  const rowPiecesPerUnit = parsedRow.row.装箱数;

  if (typeof rowPiecesPerUnit === 'number' && rowPiecesPerUnit > 0) {
    return {
      piecesPerUnit: rowPiecesPerUnit,
      piecesPerUnitSource: 'row' as const,
      batchPiecesPerUnit: rowPiecesPerUnit,
    };
  }

  return {};
}

function resolveBatchSpecificationPiecesPerUnit(
  parsedRow: ParsedInitialStockRow,
  product: ProductLookup,
  piecesPerUnitResolution: {
    piecesPerUnit?: number;
  },
  weightResolution: {
    weight?: number;
  }
):
  | {
      batchPiecesPerUnit?: number;
    }
  | {
      error: InitialStockImportError;
    } {
  if (
    typeof piecesPerUnitResolution.piecesPerUnit === 'number' &&
    piecesPerUnitResolution.piecesPerUnit > 0
  ) {
    return {
      batchPiecesPerUnit: piecesPerUnitResolution.piecesPerUnit,
    };
  }

  if (
    typeof weightResolution.weight !== 'number' ||
    weightResolution.weight <= 0
  ) {
    return {};
  }

  if (
    typeof product.piecesPerUnit === 'number' &&
    product.piecesPerUnit > 0
  ) {
    return {
      batchPiecesPerUnit: product.piecesPerUnit,
    };
  }

  return {
    error: createImportError(
      parsedRow.rowNumber,
      '填写“本批次实际每件重量(kg)”但未填写装箱数时，需要先在产品管理中维护默认装箱数，或在当前行补充装箱数后再导入',
      '装箱数',
      product.code
    ),
  };
}

function resolveQuantity(
  parsedRow: ParsedInitialStockRow,
  productCode: string,
  piecesPerUnitResolution: {
    piecesPerUnit?: number;
  }
):
  | {
      inputQuantity: number;
      quantityUnit: InitialStockQuantityUnit;
      quantityUnitSource: 'row' | 'default';
      quantity: number;
    }
  | {
      error: InitialStockImportError;
    } {
  const inputQuantity = parsedRow.row.数量;
  const quantityUnit = parsedRow.row.数量单位 ?? '片';
  const quantityUnitSource = parsedRow.row.数量单位 ? 'row' : 'default';

  if (quantityUnit === '片') {
    return {
      inputQuantity,
      quantityUnit,
      quantityUnitSource,
      quantity: inputQuantity,
    };
  }

  if (
    typeof piecesPerUnitResolution.piecesPerUnit !== 'number' ||
    piecesPerUnitResolution.piecesPerUnit <= 0
  ) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        '数量单位填写“件”时，当前行必须填写装箱数',
        '装箱数',
        productCode
      ),
    };
  }

  const convertedQuantity =
    inputQuantity * piecesPerUnitResolution.piecesPerUnit;
  const roundedQuantity = Math.round(convertedQuantity);

  if (
    !Number.isSafeInteger(roundedQuantity) ||
    roundedQuantity <= 0 ||
    Math.abs(convertedQuantity - roundedQuantity) > 1e-8
  ) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        '换算后的片数必须是整数，请检查件数和装箱数后重试',
        '数量',
        productCode
      ),
    };
  }

  return {
    inputQuantity,
    quantityUnit,
    quantityUnitSource,
    quantity: roundedQuantity,
  };
}

function resolveUnitCost(
  parsedRow: ParsedInitialStockRow,
  quantityResolution: {
    quantityUnit: InitialStockQuantityUnit;
  },
  piecesPerUnitResolution: {
    piecesPerUnit?: number;
  },
  productCode: string
):
  | {
      unitCost: number;
    }
  | {
      error: InitialStockImportError;
    } {
  const inputUnitCost = parsedRow.row.单位成本;
  const unitCostBasis = parsedRow.row.unitCostBasis ?? 'entry';

  if (
    quantityResolution.quantityUnit !== '件' ||
    unitCostBasis === 'piece'
  ) {
    return {
      unitCost: inputUnitCost,
    };
  }

  if (
    typeof piecesPerUnitResolution.piecesPerUnit !== 'number' ||
    piecesPerUnitResolution.piecesPerUnit <= 0
  ) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        '数量单位填写“件”时，当前行必须填写装箱数',
        '装箱数',
        productCode
      ),
    };
  }

  return {
    unitCost: roundCostPrice(
      inputUnitCost / piecesPerUnitResolution.piecesPerUnit
    ),
  };
}

function resolveWeight(
  parsedRow: ParsedInitialStockRow,
  _product: ProductLookup
): {
  weight?: number;
  weightSource?: 'row';
} {
  const rowWeight = parsedRow.row['本批次实际每件重量(kg)'];

  if (typeof rowWeight === 'number' && rowWeight > 0) {
    return {
      weight: rowWeight,
      weightSource: 'row',
    };
  }

  return {};
}

function resolveSupplier(
  parsedRow: ParsedInitialStockRow,
  context: InitialStockImportContext,
  productCode?: string
):
  | {
      supplierId?: string;
      supplierName?: string;
    }
  | {
      error: InitialStockImportError;
    } {
  const supplierNameInput = parsedRow.row.供应商.trim();

  if (!supplierNameInput) {
    return {};
  }

  const normalizedInput = normalizeLookupKey(supplierNameInput);
  const matchedByCode = context.supplierByCode.get(normalizedInput);

  if (matchedByCode) {
    return {
      supplierId: matchedByCode.id,
      supplierName: matchedByCode.name,
    };
  }

  const matchedByName = context.suppliersByName.get(normalizedInput) ?? [];

  if (matchedByName.length === 0) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        `供应商 ${supplierNameInput} 不存在，请先在供应商管理中创建后再导入`,
        '供应商',
        productCode
      ),
    };
  }

  if (matchedByName.length > 1) {
    return {
      error: createImportError(
        parsedRow.rowNumber,
        `供应商 ${supplierNameInput} 存在重名，请填写唯一供应商编码后再导入`,
        '供应商',
        productCode
      ),
    };
  }

  const supplier = matchedByName[0];

  return {
    supplierId: supplier.id,
    supplierName: supplier.name,
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

  rows.map(normalizeInitialStockRowAliases).forEach((rawRow, index) => {
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
  const seenRowKeys = new Map<
    string,
    { row: number; piecesPerUnit?: number }
  >();
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

    // 装箱数提前解析（仅依赖当前行），用于判定"同产品+批次但不同包装规格"的真冲突。
    const piecesPerUnitResolution = resolvePiecesPerUnit(
      parsedRow,
      productResolution.product
    );

    const firstSeen = seenRowKeys.get(rowKey);

    if (firstSeen !== undefined) {
      const samePiecesPerUnit =
        firstSeen.piecesPerUnit === piecesPerUnitResolution.piecesPerUnit;

      if (!samePiecesPerUnit) {
        errors.push(
          createImportError(
            parsedRow.rowNumber,
            `与第 ${firstSeen.row} 行的产品/色号/批次相同，但装箱数不一致（${
              firstSeen.piecesPerUnit ?? '未填写'
            } vs ${
              piecesPerUnitResolution.piecesPerUnit ?? '未填写'
            }）。同一批次的装箱数必须一致，请核对后修改`,
            '装箱数',
            productResolution.product.code
          )
        );
        continue;
      }

      duplicates.push(
        createImportDuplicate(
          parsedRow.rowNumber,
          'file',
          `与第 ${firstSeen.row} 行的产品/色号/批次重复，本次将自动跳过`,
          {
            productCode: productResolution.product.code,
            batchNumber: finalBatchNumber,
          }
        )
      );
      continue;
    }

    seenRowKeys.set(rowKey, {
      row: parsedRow.rowNumber,
      piecesPerUnit: piecesPerUnitResolution.piecesPerUnit,
    });

    const quantityResolution = resolveQuantity(
      parsedRow,
      productResolution.product.code,
      piecesPerUnitResolution
    );
    const weightResolution = resolveWeight(
      parsedRow,
      productResolution.product
    );
    const supplierResolution = resolveSupplier(
      parsedRow,
      context,
      productResolution.product.code
    );

    if ('error' in quantityResolution) {
      errors.push(quantityResolution.error);
      continue;
    }

    if ('error' in supplierResolution) {
      errors.push(supplierResolution.error);
      continue;
    }

    const unitCostResolution = resolveUnitCost(
      parsedRow,
      quantityResolution,
      piecesPerUnitResolution,
      productResolution.product.code
    );

    if ('error' in unitCostResolution) {
      errors.push(unitCostResolution.error);
      continue;
    }

    const batchSpecificationPiecesPerUnitResolution =
      resolveBatchSpecificationPiecesPerUnit(
        parsedRow,
        productResolution.product,
        piecesPerUnitResolution,
        weightResolution
      );

    if ('error' in batchSpecificationPiecesPerUnitResolution) {
      errors.push(batchSpecificationPiecesPerUnitResolution.error);
      continue;
    }

    preliminaryRows.push({
      rowNumber: parsedRow.rowNumber,
      product: productResolution.product,
      variantId: variantResolution.variantId,
      batchNumber: finalBatchNumber,
      inputQuantity: quantityResolution.inputQuantity,
      quantityUnit: quantityResolution.quantityUnit,
      quantityUnitSource: quantityResolution.quantityUnitSource,
      piecesPerUnit: piecesPerUnitResolution.piecesPerUnit,
      piecesPerUnitSource: piecesPerUnitResolution.piecesPerUnitSource,
      batchPiecesPerUnit:
        batchSpecificationPiecesPerUnitResolution.batchPiecesPerUnit,
      weight: weightResolution.weight,
      weightSource: weightResolution.weightSource,
      quantity: quantityResolution.quantity,
      unitCost: unitCostResolution.unitCost,
      supplierId: supplierResolution.supplierId,
      supplierName: supplierResolution.supplierName,
      location: parsedRow.row.库位 || undefined,
      remarks: parsedRow.row.备注 || parsedRow.row.成本来源 || '期初库存导入',
      preview: {
        row: parsedRow.rowNumber,
        productCode: productResolution.product.code,
        productName: productResolution.product.name,
        specification: productResolution.product.specification ?? '',
        colorCode: variantResolution.colorCode,
        batchNumber: finalBatchNumber,
        inputQuantity: quantityResolution.inputQuantity,
        quantityUnit: quantityResolution.quantityUnit,
        quantityUnitSource: quantityResolution.quantityUnitSource,
        piecesPerUnit: piecesPerUnitResolution.piecesPerUnit,
        piecesPerUnitSource: piecesPerUnitResolution.piecesPerUnitSource,
        weight: weightResolution.weight,
        weightSource: weightResolution.weightSource,
        quantity: quantityResolution.quantity,
        unitCost: unitCostResolution.unitCost,
        supplierName: supplierResolution.supplierName,
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
  const importBatchId =
    importableRows.length > 0 ? createOpeningImportBatchId() : undefined;

  for (const row of importableRows) {
    try {
      await executeMinimalInboundTransaction({
        productId: row.product.id,
        variantId: row.variantId,
        quantity: row.quantity,
        unitCost: row.unitCost,
        piecesPerUnit: row.batchPiecesPerUnit,
        weight: row.weightSource === 'row' ? row.weight : undefined,
        reason: 'opening_balance',
        remarks: row.remarks,
        batchNumber: row.batchNumber,
        openingImportBatchId: importBatchId,
        location: row.location,
        userId,
        supplierId: row.supplierId,
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
    importBatchId,
  };
}

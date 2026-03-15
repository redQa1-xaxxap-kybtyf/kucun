import { prisma } from '@/lib/db';
import { productCreateSchema } from '@/lib/validations/product';
import {
  productImportSchema,
  type ProductImportRow,
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
  parentId: string | null;
};

type ProductImportContext = {
  existingCodes: Set<string>;
  categoryByCode: Map<string, CategoryLookup>;
  categoriesByName: Map<string, CategoryLookup[]>;
  categoryByPath: Map<string, CategoryLookup>;
  categoryPathById: Map<string, string>;
};

function normalizeLookupKey(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeCategoryPath(value: string | undefined): string {
  const normalized = (value ?? '')
    .split(/[/>＞]/)
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');

  return normalizeLookupKey(normalized);
}

function getRowString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function getCategoryNameInput(row: ProductImportRow | ProductImportRowInput) {
  return getRowString(row.分类名称);
}

function getUnifiedCategoryInput(
  row: ProductImportRow | ProductImportRowInput
) {
  return getRowString(row.产品分类);
}

function getCategoryPathInput(row: ProductImportRow | ProductImportRowInput) {
  return getRowString(row.分类路径);
}

function getCategoryCodeInput(row: ProductImportRow | ProductImportRowInput) {
  return getRowString(row.分类编码);
}

function getCategoryLevelInputs(
  row: ProductImportRow | ProductImportRowInput
): [string, string, string] {
  return [
    getRowString(row.一级分类),
    getRowString(row.二级分类),
    getRowString(row.三级分类),
  ];
}

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

async function loadImportContext(rows: ProductImportRow[]) {
  const productCodes = rows.map(row => getRowString(row.产品编码));
  const hasCategoryInput = rows.some(
    row =>
      getUnifiedCategoryInput(row) ||
      getCategoryNameInput(row) ||
      getCategoryPathInput(row) ||
      getCategoryCodeInput(row) ||
      getCategoryLevelInputs(row).some(Boolean)
  );

  const [existingProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where: { code: { in: productCodes } },
      select: { code: true },
    }),
    hasCategoryInput
      ? prisma.category.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            parentId: true,
          },
        })
      : Promise.resolve([] as CategoryLookup[]),
  ]);

  const categoryById = new Map(
    categories.map(category => [category.id, category])
  );
  const categoryPathById = new Map<string, string>();

  const getCategoryPath = (category: CategoryLookup): string => {
    const cached = categoryPathById.get(category.id);
    if (cached) {
      return cached;
    }

    const names: string[] = [];
    let current: CategoryLookup | undefined = category;
    let safetyCounter = 0;

    while (current && safetyCounter < 10) {
      names.unshift(current.name.trim());
      current = current.parentId
        ? categoryById.get(current.parentId)
        : undefined;
      safetyCounter += 1;
    }

    const path = names.join('/');
    categoryPathById.set(category.id, path);
    return path;
  };

  const categoriesByName = new Map<string, CategoryLookup[]>();
  const categoryByCode = new Map<string, CategoryLookup>();
  const categoryByPath = new Map<string, CategoryLookup>();

  categories.forEach(category => {
    const codeKey = normalizeLookupKey(category.code);
    if (codeKey) {
      categoryByCode.set(codeKey, category);
    }

    const nameKey = normalizeLookupKey(category.name);
    if (nameKey) {
      const current = categoriesByName.get(nameKey) ?? [];
      current.push(category);
      categoriesByName.set(nameKey, current);
    }

    const pathKey = normalizeCategoryPath(getCategoryPath(category));
    if (pathKey) {
      categoryByPath.set(pathKey, category);
    }
  });

  return {
    existingCodes: new Set(existingProducts.map(product => product.code)),
    categoryByCode,
    categoriesByName,
    categoryByPath,
    categoryPathById,
  };
}

function buildCreatePayload(
  row: ProductImportRow,
  category: CategoryLookup | undefined
): ProductCreateData {
  const status = normalizeStatus(row.状态);
  const thickness = row['厚度(mm)'];

  return {
    code: row.产品编码.trim(),
    name: row.产品名称.trim(),
    specification: row.规格.trim(),
    description: row.描述?.trim() ? row.描述.trim() : '',
    thickness,
    status,
    categoryId: category?.id ?? 'uncategorized',
    thumbnailUrl: '',
    images: undefined,
  };
}

function buildPreviewRow(
  rowNumber: number,
  payload: ProductCreateData,
  categoryDisplayName: string
): ProductImportPreviewRow {
  return {
    row: rowNumber,
    code: payload.code,
    name: payload.name,
    specification: payload.specification,
    categoryName: categoryDisplayName,
    ...(typeof payload.thickness === 'number'
      ? { thickness: payload.thickness }
      : {}),
    status: (payload.status ?? 'active') as 'active' | 'inactive',
  };
}

type CategoryLookupInput = {
  lookupPath?: string;
  lookupName?: string;
  lookupCode?: string;
  displayValue: string;
  primaryField?: string;
  error?: ProductImportError;
};

function lastNonEmptyIndex(values: string[]) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index]) {
      return index;
    }
  }

  return -1;
}

function buildCategoryLookupInput(
  rowNumber: number,
  row: ProductImportRow,
  productCode: string
): CategoryLookupInput {
  const unifiedCategoryInput = getUnifiedCategoryInput(row);
  const levelValues = getCategoryLevelInputs(row);
  const lastLevelIndex = lastNonEmptyIndex(levelValues);

  if (lastLevelIndex >= 0) {
    const missingLevelIndex = levelValues
      .slice(0, lastLevelIndex + 1)
      .findIndex(level => !level);

    if (missingLevelIndex >= 0) {
      const fieldLabels = ['一级分类', '二级分类', '三级分类'];
      return {
        displayValue: levelValues.filter(Boolean).join('/'),
        primaryField: fieldLabels[missingLevelIndex],
        error: createImportError(
          rowNumber,
          '多级分类必须从一级到三级连续填写，不能跳级',
          fieldLabels[missingLevelIndex],
          productCode
        ),
      };
    }
  }

  const lookupPathFromLevels = levelValues.filter(Boolean).join('/');
  const lookupPathFromColumn = getCategoryPathInput(row);
  const categoryNameInput = getCategoryNameInput(row);
  const lookupCode = getCategoryCodeInput(row);
  const unifiedLooksLikePath = /[/>＞]/.test(unifiedCategoryInput);

  let lookupPath = unifiedLooksLikePath
    ? unifiedCategoryInput
    : lookupPathFromLevels;
  let lookupName = '';
  let displayValue =
    unifiedCategoryInput ||
    lookupPathFromLevels ||
    lookupPathFromColumn ||
    categoryNameInput ||
    lookupCode;
  let primaryField = unifiedCategoryInput
    ? '产品分类'
    : lookupPathFromLevels
      ? '一级分类'
      : undefined;

  if (unifiedCategoryInput && !unifiedLooksLikePath) {
    lookupName = unifiedCategoryInput;
  }

  if (unifiedCategoryInput && lookupPathFromLevels) {
    const expectedFromLevels = normalizeCategoryPath(lookupPathFromLevels);
    const normalizedUnified = unifiedLooksLikePath
      ? normalizeCategoryPath(unifiedCategoryInput)
      : normalizeLookupKey(unifiedCategoryInput);
    const normalizedLevelLeaf = normalizeLookupKey(
      levelValues[lastNonEmptyIndex(levelValues)] ?? ''
    );

    const isConsistent =
      normalizedUnified === expectedFromLevels ||
      normalizedUnified === normalizedLevelLeaf;

    if (!isConsistent) {
      return {
        displayValue: `${unifiedCategoryInput} / ${lookupPathFromLevels}`,
        primaryField: '产品分类',
        error: createImportError(
          rowNumber,
          '产品分类与一级/二级/三级分类不一致，请只保留一种填写方式或确保一致',
          '产品分类',
          productCode
        ),
      };
    }
  }

  if (lookupPathFromColumn) {
    if (
      lookupPath &&
      normalizeCategoryPath(lookupPath) !==
        normalizeCategoryPath(lookupPathFromColumn)
    ) {
      return {
        displayValue: `${lookupPath} / ${lookupPathFromColumn}`,
        primaryField: '分类路径',
        error: createImportError(
          rowNumber,
          unifiedCategoryInput
            ? '产品分类与分类路径不一致，请只保留一种填写方式或确保一致'
            : '一级/二级/三级分类与分类路径不一致，请只保留一种填写方式或确保一致',
          '分类路径',
          productCode
        ),
      };
    }

    lookupPath = lookupPathFromColumn;
    displayValue = lookupPathFromColumn;
    primaryField = '分类路径';
  }

  if (categoryNameInput) {
    const categoryNameLooksLikePath = /[/>＞]/.test(categoryNameInput);

    if (categoryNameLooksLikePath) {
      if (
        lookupPath &&
        normalizeCategoryPath(lookupPath) !==
          normalizeCategoryPath(categoryNameInput)
      ) {
        return {
          displayValue: `${lookupPath} / ${categoryNameInput}`,
          primaryField: '分类名称',
          error: createImportError(
            rowNumber,
            unifiedCategoryInput
              ? '产品分类与分类名称不一致，请只保留一种填写方式或确保一致'
              : '分类名称与分类路径不一致，请只保留一种填写方式或确保一致',
            '分类名称',
            productCode
          ),
        };
      }

      lookupPath = categoryNameInput;
      displayValue = categoryNameInput;
      primaryField = '分类名称';
    } else {
      lookupName = categoryNameInput;

      if (lookupPath) {
        const pathSegments = lookupPath
          .split(/[/>＞]/)
          .map(segment => segment.trim())
          .filter(Boolean);
        const leafName = pathSegments[pathSegments.length - 1] ?? '';

        if (
          leafName &&
          normalizeLookupKey(leafName) !== normalizeLookupKey(categoryNameInput)
        ) {
          return {
            displayValue: `${lookupPath} / ${categoryNameInput}`,
            primaryField: '分类名称',
            error: createImportError(
              rowNumber,
              unifiedCategoryInput
                ? '产品分类与分类名称不一致，请只保留一种填写方式或确保一致'
                : '分类名称与多级分类路径不一致，请检查后重试',
              '分类名称',
              productCode
            ),
          };
        }
      } else {
        displayValue = categoryNameInput;
        primaryField = '分类名称';
      }
    }
  }

  if (!lookupPath && !lookupName && !lookupCode) {
    return {
      displayValue: '无分类',
    };
  }

  return {
    lookupPath,
    lookupName,
    lookupCode,
    displayValue,
    primaryField: primaryField ?? (lookupCode ? '分类编码' : undefined),
  };
}

function resolveCategory(
  rowNumber: number,
  row: ProductImportRow,
  context: ProductImportContext,
  productCode: string
): {
  category?: CategoryLookup;
  categoryDisplayName: string;
  error?: ProductImportError;
} {
  const lookupInput = buildCategoryLookupInput(rowNumber, row, productCode);

  if (lookupInput.error) {
    return {
      categoryDisplayName: lookupInput.displayValue,
      error: lookupInput.error,
    };
  }

  let category: CategoryLookup | undefined;

  if (lookupInput.lookupPath) {
    category = context.categoryByPath.get(
      normalizeCategoryPath(lookupInput.lookupPath)
    );

    if (!category) {
      return {
        categoryDisplayName: lookupInput.displayValue,
        error: createImportError(
          rowNumber,
          '分类路径不存在，请从模板中的分类参考工作表复制填写',
          lookupInput.primaryField ?? '分类路径',
          productCode
        ),
      };
    }
  } else if (lookupInput.lookupName) {
    const matches =
      context.categoriesByName.get(
        normalizeLookupKey(lookupInput.lookupName)
      ) ?? [];

    if (matches.length === 0) {
      return {
        categoryDisplayName: lookupInput.displayValue,
        error: createImportError(
          rowNumber,
          '分类名称不存在',
          lookupInput.primaryField ?? '分类名称',
          productCode
        ),
      };
    }

    if (matches.length > 1) {
      const examples = matches
        .slice(0, 3)
        .map(match => context.categoryPathById.get(match.id) ?? match.name)
        .join('、');
      const suffix = matches.length > 3 ? ' 等' : '';

      return {
        categoryDisplayName: lookupInput.displayValue,
        error: createImportError(
          rowNumber,
          `分类名称存在多个匹配，请填写完整路径或一级/二级/三级分类：${examples}${suffix}`,
          lookupInput.primaryField ?? '分类名称',
          productCode
        ),
      };
    }

    [category] = matches;
  }

  if (!category && lookupInput.lookupCode) {
    category = context.categoryByCode.get(
      normalizeLookupKey(lookupInput.lookupCode)
    );

    if (!category) {
      return {
        categoryDisplayName: lookupInput.displayValue,
        error: createImportError(
          rowNumber,
          '分类编码不存在',
          '分类编码',
          productCode
        ),
      };
    }
  }

  if (
    category &&
    lookupInput.lookupCode &&
    normalizeLookupKey(category.code) !==
      normalizeLookupKey(lookupInput.lookupCode)
  ) {
    return {
      categoryDisplayName:
        context.categoryPathById.get(category.id) ?? category.name,
      error: createImportError(
        rowNumber,
        '分类信息与分类编码不一致',
        lookupInput.primaryField ?? '分类编码',
        productCode
      ),
    };
  }

  if (category && category.status.toLowerCase() !== 'active') {
    return {
      categoryDisplayName:
        context.categoryPathById.get(category.id) ?? category.name,
      error: createImportError(
        rowNumber,
        '分类已停用，不能导入到该分类',
        lookupInput.primaryField ?? '分类编码',
        productCode
      ),
    };
  }

  return {
    category,
    categoryDisplayName: category
      ? (context.categoryPathById.get(category.id) ?? category.name)
      : '无分类',
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
    const productCode = row.产品编码.trim();

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

    const categoryResolution = resolveCategory(
      rowNumber,
      row,
      context,
      productCode
    );

    if (categoryResolution.error) {
      errors.push(categoryResolution.error);
      return;
    }

    let payload: ProductCreateData;
    try {
      payload = buildCreatePayload(row, categoryResolution.category);
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
      preview: buildPreviewRow(
        rowNumber,
        validationResult.data,
        categoryResolution.categoryDisplayName
      ),
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

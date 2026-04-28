import { createHash } from 'node:crypto';

import { prisma } from '@/lib/db';
import { getLongTransactionOptions } from '@/lib/db/transaction-options';
import type { SalesOrderCreateInput } from '@/lib/types/sales-order';
import {
  DATE_FORMATS,
  formatDate,
  parseLocalDateString,
} from '@/lib/utils/datetime';
import {
  transformFormItemToCreateInput,
  type SalesOrderFormItem,
} from '@/lib/utils/sales-order-transforms';
import { salesOrderCreateSchema } from '@/lib/validations/sales-order';
import {
  salesOrderImportRowSchema,
  salesOrderImportSchema,
  type SalesOrderImportRow,
} from '@/lib/validations/sales-order-import';

import { updateSalesOrderStatus } from './sales-order-status';
import { createSalesOrderWithOptions } from './sales-orders/create';

export interface SalesOrderImportError {
  row: number;
  importOrderNo?: string;
  productCode?: string;
  field?: string;
  message: string;
}

export interface SalesOrderImportDuplicate {
  row: number;
  importOrderNo: string;
  source: 'system';
  existingOrderNumber?: string;
  message: string;
}

export interface SalesOrderImportPreviewRow {
  row: number;
  importOrderNo: string;
  customerName: string;
  orderDate: string;
  productCode: string;
  productName: string;
  specification: string;
  colorCode?: string;
  batchNumber?: string;
  productionDate?: string;
  displayUnit: '片' | '件';
  displayQuantity: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  orderRemarks?: string;
  itemRemarks?: string;
}

export interface SalesOrderImportValidationResult {
  valid: boolean;
  totalRowCount: number;
  totalOrderCount: number;
  validOrderCount: number;
  autoCreateCustomerNames: string[];
  duplicateOrderCount: number;
  errorCount: number;
  previewRows: SalesOrderImportPreviewRow[];
  duplicates: SalesOrderImportDuplicate[];
  errors: SalesOrderImportError[];
}

export interface SalesOrderImportExecutionResult
  extends SalesOrderImportValidationResult {
  importedCount: number;
  importedOrders: Array<{
    id: string;
    orderNumber: string;
    importOrderNo: string;
    customerName: string;
    totalAmount: number;
  }>;
}

export type SalesOrderImportTargetStatus = 'confirmed' | 'shipped';

export interface SalesOrderImportExecutionOptions {
  shippedDate?: string;
  targetStatus?: SalesOrderImportTargetStatus;
}

const IMPORT_TARGET_STATUS = 'confirmed';
const IMPORT_TARGET_DATA_TAG = 'prod';
const AUTO_CREATE_CUSTOMER_PLACEHOLDER_ID = '__auto-create_customer__';

type ImportLookupClient = Pick<typeof prisma, 'customer' | 'salesOrder'>;

type CustomerLookup = {
  id: string;
  name: string;
};

type ProductLookup = {
  id: string;
  code: string;
  name: string;
  specification: string | null;
  piecesPerUnit: number | null;
};

type ImportContext = {
  customerByName: Map<string, CustomerLookup>;
  productByCode: Map<string, ProductLookup>;
};

type OrderBucket = {
  customerId?: string;
  customerName: string;
  customerLookupKey: string;
  importOrderNo: string;
  importOrderNoSource: 'provided' | 'generated';
  items: SalesOrderCreateInput['items'];
  orderAmount: number;
  orderDate?: string;
  orderRemarks?: string;
  previewRows: SalesOrderImportPreviewRow[];
  rowNumbers: number[];
};

type PreparedSalesOrderImport = {
  importableOrders: OrderBucket[];
  validation: SalesOrderImportValidationResult;
};

type ImportExecutionAbort =
  | {
      kind: 'duplicate';
      duplicate: SalesOrderImportDuplicate;
    }
  | {
      kind: 'error';
      error: SalesOrderImportError;
    };

function pickRowValue(
  row: Record<string, unknown>,
  keys: string[],
  fallback?: unknown
) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return fallback;
}

function normalizeImportRowInput(row: unknown) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return row;
  }

  const raw = row as Record<string, unknown>;

  return {
    ...raw,
    导入单号: pickRowValue(raw, ['导入单号', '销售单号', '单号']),
    客户名称: pickRowValue(raw, ['客户名称', '客户', '客户名']),
    订单日期: pickRowValue(raw, ['订单日期', '销售日期', '日期'], ''),
    产品编码: pickRowValue(raw, ['产品编码', '商品编码']),
    产品名称: pickRowValue(raw, ['产品名称', '商品名称'], ''),
    装箱数: pickRowValue(raw, ['装箱数'], ''),
    规格: pickRowValue(raw, ['规格'], ''),
    色号: pickRowValue(raw, ['色号'], ''),
    批次号: pickRowValue(raw, ['批次号'], ''),
    生产日期: pickRowValue(raw, ['生产日期'], ''),
    单位: pickRowValue(raw, ['单位'], ''),
    数量: pickRowValue(raw, ['数量']),
    单价: pickRowValue(raw, ['销售单价', '单价']),
    金额: pickRowValue(raw, ['金额', '小计'], ''),
    订单备注: pickRowValue(raw, ['订单备注'], ''),
    明细备注: pickRowValue(raw, ['明细备注', '备注'], ''),
  };
}

function normalizeLookupKey(value: string | undefined) {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getTodayDateString() {
  return formatDate(new Date(), DATE_FORMATS.DATE);
}

function normalizeImportTargetStatus(
  status: SalesOrderImportExecutionOptions['targetStatus']
): SalesOrderImportTargetStatus {
  return status === 'shipped' ? 'shipped' : 'confirmed';
}

function normalizeSalesOrderImportOptions(
  options: SalesOrderImportExecutionOptions = {}
) {
  const targetStatus = normalizeImportTargetStatus(options.targetStatus);
  const shippedDate = options.shippedDate?.trim() || undefined;

  if (
    targetStatus === 'shipped' &&
    shippedDate &&
    !parseLocalDateString(shippedDate)
  ) {
    throw new Error('统一发货日期格式不正确，请使用 YYYY-MM-DD');
  }

  return {
    targetStatus,
    shippedDate,
  } satisfies Required<Pick<SalesOrderImportExecutionOptions, 'targetStatus'>> &
    Pick<SalesOrderImportExecutionOptions, 'shippedDate'>;
}

function buildImportToken(importOrderNo: string) {
  return `【销售导入:${importOrderNo}】`;
}

function normalizeComparisonText(value: string | undefined | null) {
  return normalizeLookupKey(value ?? '');
}

function normalizeImportedOrderRemarks(remarks: string | undefined) {
  const normalizedRemarks = remarks?.trim();

  if (!normalizedRemarks) {
    return undefined;
  }

  return normalizedRemarks;
}

function extractLegacyImportKeyFromRemarks(remarks: string | null | undefined) {
  if (!remarks) {
    return undefined;
  }

  const match = remarks.match(/【销售导入:([^】]+)】/);
  return match?.[1]?.trim() || undefined;
}

function createImportError(
  row: number,
  message: string,
  options: {
    field?: string;
    importOrderNo?: string;
    productCode?: string;
  } = {}
): SalesOrderImportError {
  return {
    row,
    message,
    ...(options.field ? { field: options.field } : {}),
    ...(options.importOrderNo ? { importOrderNo: options.importOrderNo } : {}),
    ...(options.productCode ? { productCode: options.productCode } : {}),
  };
}

function createImportExecutionAbort(
  payload: ImportExecutionAbort
): ImportExecutionAbort {
  return payload;
}

function isDuplicateImportExecutionAbort(
  error: unknown
): error is Extract<ImportExecutionAbort, { kind: 'duplicate' }> {
  return (
    !!error &&
    typeof error === 'object' &&
    'kind' in error &&
    (error as ImportExecutionAbort).kind === 'duplicate'
  );
}

function isErrorImportExecutionAbort(
  error: unknown
): error is Extract<ImportExecutionAbort, { kind: 'error' }> {
  return (
    !!error &&
    typeof error === 'object' &&
    'kind' in error &&
    (error as ImportExecutionAbort).kind === 'error'
  );
}

function isImportKeyUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const maybeError = error as {
    code?: unknown;
    message?: unknown;
    meta?: unknown;
  };
  const code = typeof maybeError.code === 'string' ? maybeError.code : '';
  const message =
    typeof maybeError.message === 'string'
      ? maybeError.message
      : error instanceof Error
        ? error.message
        : '';

  if (code === 'P2002') {
    const meta = (maybeError.meta ?? {}) as Record<string, unknown>;
    const target = meta.target;
    const constraint = meta.constraint;

    if (
      (Array.isArray(target) && target.includes('importKey')) ||
      (typeof target === 'string' &&
        (target.includes('importKey') || target.includes('import_key'))) ||
      (typeof constraint === 'string' &&
        (constraint.includes('uk_sales_orders_import_key') ||
          constraint.includes('importKey') ||
          constraint.includes('import_key')))
    ) {
      return true;
    }
  }

  return (
    message.includes('uk_sales_orders_import_key') ||
    /unique constraint failed.*importkey/i.test(message) ||
    /duplicate key.*import[_ ]key/i.test(message)
  );
}

async function loadImportContext(rows: SalesOrderImportRow[]) {
  const customerNames = Array.from(new Set(rows.map(row => row.客户名称)));
  const productCodes = Array.from(new Set(rows.map(row => row.产品编码)));

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        name: { in: customerNames },
      },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.product.findMany({
      where: {
        code: { in: productCodes },
      },
      select: {
        id: true,
        code: true,
        name: true,
        specification: true,
        piecesPerUnit: true,
      },
    }),
  ]);

  return {
    customerByName: new Map(
      customers.map(customer => [normalizeLookupKey(customer.name), customer])
    ),
    productByCode: new Map(
      products.map(product => [normalizeLookupKey(product.code), product])
    ),
  } satisfies ImportContext;
}

async function loadExistingImportedOrderNumbers(
  db: Pick<ImportLookupClient, 'salesOrder'>,
  importOrderNos: string[]
) {
  if (importOrderNos.length === 0) {
    return new Map<string, string>();
  }

  const existingImportedOrders = await db.salesOrder.findMany({
    where: {
      OR: [
        ...importOrderNos.map(importOrderNo => ({
          remarks: {
            contains: buildImportToken(importOrderNo),
          },
        })),
        {
          importKey: {
            in: importOrderNos,
          },
        },
      ],
    },
    select: {
      importKey: true,
      orderNumber: true,
      remarks: true,
    },
  });

  const existingImportedOrderNumbers = new Map<string, string>();
  existingImportedOrders.forEach(order => {
    const importKey = order.importKey?.trim();
    if (importKey && importOrderNos.includes(importKey)) {
      existingImportedOrderNumbers.set(importKey, order.orderNumber);
    }
  });

  importOrderNos.forEach(importOrderNo => {
    const existingOrder = existingImportedOrders.find(
      order =>
        extractLegacyImportKeyFromRemarks(order.remarks) === importOrderNo
    );
    if (existingOrder) {
      existingImportedOrderNumbers.set(
        importOrderNo,
        existingOrder.orderNumber
      );
    }
  });

  return existingImportedOrderNumbers;
}

async function findOrCreateCustomerByName(
  db: Pick<ImportLookupClient, 'customer'>,
  customerName: string
): Promise<CustomerLookup> {
  return db.customer.upsert({
    where: {
      name: customerName,
    },
    update: {},
    create: {
      name: customerName,
      role: 'customer',
    },
    select: {
      id: true,
      name: true,
    },
  });
}

function buildImportPreviewRow(options: {
  customerName: string;
  importOrderNo: string;
  orderDate: string;
  orderRemarks?: string;
  product: ProductLookup;
  row: number;
  rowData: SalesOrderImportRow;
  transformedItem: SalesOrderCreateInput['items'][number];
}) {
  return {
    row: options.row,
    importOrderNo: options.importOrderNo,
    customerName: options.customerName,
    orderDate: options.orderDate,
    productCode: options.product.code,
    productName: options.product.name,
    specification:
      options.transformedItem.specification ||
      options.product.specification ||
      '',
    colorCode: options.rowData.色号 || undefined,
    batchNumber: options.rowData.批次号 || undefined,
    productionDate: options.rowData.生产日期 || undefined,
    displayUnit: (options.transformedItem.displayUnit as '片' | '件') || '片',
    displayQuantity: Number(options.transformedItem.displayQuantity ?? 0),
    quantity: Number(options.transformedItem.quantity ?? 0),
    unitPrice: Number(options.rowData.单价),
    subtotal: Number(options.transformedItem.subtotal ?? 0),
    orderRemarks: options.orderRemarks || undefined,
    itemRemarks: options.rowData.明细备注 || undefined,
  } satisfies SalesOrderImportPreviewRow;
}

function mapSchemaIssueField(
  issuePath: Array<PropertyKey>,
  options: {
    itemLevel: boolean;
  }
) {
  const field = issuePath[options.itemLevel ? 2 : 0];

  if (typeof field !== 'string') {
    return options.itemLevel ? '导入单号' : undefined;
  }

  if (options.itemLevel) {
    switch (field) {
      case 'productId':
      case 'productCode':
        return '产品编码';
      case 'batchNumber':
        return '批次号';
      case 'colorCode':
        return '色号';
      case 'productionDate':
        return '生产日期';
      case 'displayUnit':
      case 'piecesPerUnit':
        return '单位';
      case 'displayQuantity':
      case 'quantity':
      case 'subtotal':
        return '数量';
      case 'unitPrice':
        return '单价';
      case 'specification':
        return '规格';
      case 'remarks':
        return '明细备注';
      default:
        return field;
    }
  }

  switch (field) {
    case 'orderDate':
      return '订单日期';
    case 'remarks':
      return '订单备注';
    case 'items':
      return '导入单号';
    default:
      return field;
  }
}

function buildAutoGroupKey(row: SalesOrderImportRow) {
  return [
    normalizeLookupKey(row.客户名称),
    row.订单日期 || '',
    normalizeLookupKey(row.订单备注 || ''),
  ].join('::');
}

function buildProvisionalImportOrderNo(
  autoGroupKey: string,
  occurrence: number
) {
  const fingerprint = createHash('sha1')
    .update(`${autoGroupKey}::${occurrence}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  return `AUTO-SO-${fingerprint}`;
}

function buildDeterministicImportOrderNo(bucket: OrderBucket) {
  const itemSignatures = bucket.previewRows
    .map(row =>
      [
        normalizeLookupKey(row.productCode),
        normalizeLookupKey(row.productName),
        normalizeLookupKey(row.specification),
        normalizeLookupKey(row.colorCode || ''),
        normalizeLookupKey(row.batchNumber || ''),
        row.productionDate || '',
        row.displayUnit,
        row.displayQuantity,
        row.quantity,
        row.unitPrice,
        row.subtotal,
        normalizeLookupKey(row.itemRemarks || ''),
      ].join('|')
    )
    .sort();

  const rawSignature = [
    bucket.customerLookupKey,
    bucket.orderDate || '',
    normalizeLookupKey(bucket.orderRemarks || ''),
    itemSignatures.join('||'),
  ].join('::');

  const fingerprint = createHash('sha1')
    .update(rawSignature)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  return `AUTO-SO-${fingerprint}`;
}

function validatePreparedOrderBucket(
  bucket: OrderBucket,
  errors: SalesOrderImportError[],
  invalidImportOrderNos: Set<string>
) {
  const parsedOrder = salesOrderCreateSchema.safeParse({
    customerId: bucket.customerId ?? AUTO_CREATE_CUSTOMER_PLACEHOLDER_ID,
    status: IMPORT_TARGET_STATUS,
    orderType: 'NORMAL',
    orderDate: bucket.orderDate || undefined,
    remarks: normalizeImportedOrderRemarks(bucket.orderRemarks),
    items: bucket.items,
  });

  if (parsedOrder.success) {
    return;
  }

  invalidImportOrderNos.add(bucket.importOrderNo);

  parsedOrder.error.issues.forEach(issue => {
    const itemIndex =
      issue.path[0] === 'items' && typeof issue.path[1] === 'number'
        ? issue.path[1]
        : undefined;
    const row =
      typeof itemIndex === 'number'
        ? (bucket.rowNumbers[itemIndex] ?? bucket.rowNumbers[0] ?? 0)
        : (bucket.rowNumbers[0] ?? 0);
    const itemPreview =
      typeof itemIndex === 'number' ? bucket.previewRows[itemIndex] : undefined;
    const field = mapSchemaIssueField(issue.path, {
      itemLevel: typeof itemIndex === 'number',
    });
    const message =
      field === '导入单号'
        ? `导入单号 ${bucket.importOrderNo}：${issue.message}`
        : issue.message;

    errors.push(
      createImportError(row, message, {
        field,
        importOrderNo: bucket.importOrderNo,
        productCode: itemPreview?.productCode,
      })
    );
  });
}

function buildOrderItemFromImportRow(options: {
  product: ProductLookup;
  row: SalesOrderImportRow;
}) {
  const { product, row } = options;
  const displayUnit = row.单位;
  const piecesPerUnit =
    typeof row.装箱数 === 'number' && row.装箱数 > 0
      ? row.装箱数
      : typeof product.piecesPerUnit === 'number' && product.piecesPerUnit > 0
        ? product.piecesPerUnit
        : undefined;

  if (displayUnit === '件' && !piecesPerUnit) {
    throw new Error(`产品 ${product.code} 未配置装箱数，不能按“件”导入`);
  }

  const quantity =
    displayUnit === '件' && piecesPerUnit
      ? Number((row.数量 * piecesPerUnit).toFixed(2))
      : Number(row.数量);

  const formItem: SalesOrderFormItem = {
    productId: product.id,
    productCode: product.code,
    batchNumber: row.批次号 || undefined,
    colorCode: row.色号 || undefined,
    productionDate: row.生产日期 || undefined,
    specification: row.规格 || product.specification || undefined,
    remarks: row.明细备注 || undefined,
    quantity,
    unitPrice: Number(row.单价),
    displayUnit,
    displayQuantity: Number(row.数量),
    piecesPerUnit,
  };

  const transformedItem = transformFormItemToCreateInput(formItem);
  const importedSubtotal =
    typeof row.金额 === 'number'
      ? Number(row.金额)
      : Number((row.数量 * row.单价).toFixed(2));
  const normalizedUnitPrice =
    quantity > 0
      ? Number((importedSubtotal / quantity).toFixed(2))
      : Number(transformedItem.unitPrice ?? 0);

  return {
    ...transformedItem,
    unitPrice: normalizedUnitPrice,
    // 导入时保留“用户录入口径”的精确小计，避免件转片后的片单价舍入误差。
    subtotal: importedSubtotal,
  };
}

async function prepareSalesOrderImport(
  rows: unknown[]
): Promise<PreparedSalesOrderImport> {
  salesOrderImportSchema.parse({ rows });

  const parsedRows: Array<{
    rowNumber: number;
    value: SalesOrderImportRow;
    resolvedImportOrderNo: string;
  }> = [];
  const errors: SalesOrderImportError[] = [];
  const autoGroupOccurrences = new Map<string, number>();
  let lastAutoGroupKey: string | undefined;
  let lastAutoGroupImportOrderNo: string | undefined;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const normalizedRow = normalizeImportRowInput(row);
    const parsed = salesOrderImportRowSchema.safeParse(normalizedRow);
    if (!parsed.success) {
      parsed.error.issues.forEach(issue => {
        errors.push(
          createImportError(
            rowNumber,
            issue.message,
            typeof issue.path[0] === 'string'
              ? { field: issue.path[0] }
              : undefined
          )
        );
      });
      lastAutoGroupKey = undefined;
      lastAutoGroupImportOrderNo = undefined;
      return;
    }

    const providedImportOrderNo = parsed.data.导入单号.trim();
    let resolvedImportOrderNo = providedImportOrderNo;

    if (!resolvedImportOrderNo) {
      const autoGroupKey = buildAutoGroupKey(parsed.data);
      if (lastAutoGroupKey === autoGroupKey && lastAutoGroupImportOrderNo) {
        resolvedImportOrderNo = lastAutoGroupImportOrderNo;
      } else {
        const occurrence = (autoGroupOccurrences.get(autoGroupKey) ?? 0) + 1;
        autoGroupOccurrences.set(autoGroupKey, occurrence);
        resolvedImportOrderNo = buildProvisionalImportOrderNo(
          autoGroupKey,
          occurrence
        );
        lastAutoGroupKey = autoGroupKey;
        lastAutoGroupImportOrderNo = resolvedImportOrderNo;
      }
    } else {
      lastAutoGroupKey = undefined;
      lastAutoGroupImportOrderNo = undefined;
    }

    parsedRows.push({
      rowNumber,
      value: parsed.data,
      resolvedImportOrderNo,
    });
  });

  const buckets = new Map<string, OrderBucket>();
  const invalidImportOrderNos = new Set<string>();
  const duplicateOrders: SalesOrderImportDuplicate[] = [];
  const autoCreateCustomerNames = new Set<string>();

  if (parsedRows.length > 0) {
    const context = await loadImportContext(
      parsedRows.map(entry => entry.value)
    );

    for (const entry of parsedRows) {
      const { rowNumber, value, resolvedImportOrderNo } = entry;
      const importOrderNo = resolvedImportOrderNo;
      const customerLookupKey = normalizeLookupKey(value.客户名称);
      const customer = context.customerByName.get(customerLookupKey);
      const product = context.productByCode.get(
        normalizeLookupKey(value.产品编码)
      );
      const customerName = customer?.name ?? value.客户名称;
      const customerId = customer?.id;

      if (!customerId) {
        autoCreateCustomerNames.add(customerName);
      }

      if (!product) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `产品编码 ${value.产品编码} 不存在，请先创建产品`,
            {
              field: '产品编码',
              importOrderNo,
              productCode: value.产品编码,
            }
          )
        );
        continue;
      }

      if (
        value.产品名称 &&
        normalizeComparisonText(value.产品名称) !==
          normalizeComparisonText(product.name)
      ) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `产品编码 ${value.产品编码} 对应的产品名称为 ${product.name}，与导入文件中的 ${value.产品名称} 不一致`,
            {
              field: '产品名称',
              importOrderNo,
              productCode: value.产品编码,
            }
          )
        );
        continue;
      }

      if (
        value.规格 &&
        product.specification &&
        normalizeComparisonText(value.规格) !==
          normalizeComparisonText(product.specification)
      ) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `产品编码 ${value.产品编码} 对应的规格为 ${product.specification}，与导入文件中的 ${value.规格} 不一致`,
            {
              field: '规格',
              importOrderNo,
              productCode: value.产品编码,
            }
          )
        );
        continue;
      }

      let transformedItem: SalesOrderCreateInput['items'][number];
      try {
        transformedItem = buildOrderItemFromImportRow({
          product,
          row: value,
        });
      } catch (error) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            error instanceof Error ? error.message : '销售明细格式不正确',
            {
              field: '数量',
              importOrderNo,
              productCode: value.产品编码,
            }
          )
        );
        continue;
      }

      const effectiveOrderDate = value.订单日期 || getTodayDateString();
      const bucket = buckets.get(importOrderNo);

      if (!bucket) {
        const nextBucket: OrderBucket = {
          customerId,
          customerName,
          customerLookupKey,
          importOrderNo,
          importOrderNoSource: value.导入单号.trim() ? 'provided' : 'generated',
          items: [transformedItem],
          orderAmount: Number(transformedItem.subtotal ?? 0),
          orderDate: value.订单日期 || undefined,
          orderRemarks: value.订单备注 || undefined,
          previewRows: [
            buildImportPreviewRow({
              customerName,
              importOrderNo,
              orderDate: effectiveOrderDate,
              orderRemarks: value.订单备注 || undefined,
              product,
              row: rowNumber,
              rowData: value,
              transformedItem,
            }),
          ],
          rowNumbers: [rowNumber],
        };
        buckets.set(importOrderNo, nextBucket);
        continue;
      }

      if (bucket.customerLookupKey !== customerLookupKey) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `导入单号 ${importOrderNo} 存在多个不同客户，请拆分后再导入`,
            {
              field: '客户名称',
              importOrderNo,
            }
          )
        );
        continue;
      }

      if (
        bucket.orderDate &&
        value.订单日期 &&
        bucket.orderDate !== value.订单日期
      ) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `导入单号 ${importOrderNo} 存在多个不同订单日期，请统一后再导入`,
            {
              field: '订单日期',
              importOrderNo,
            }
          )
        );
        continue;
      }

      if (
        bucket.orderRemarks &&
        value.订单备注 &&
        bucket.orderRemarks !== value.订单备注
      ) {
        invalidImportOrderNos.add(importOrderNo);
        errors.push(
          createImportError(
            rowNumber,
            `导入单号 ${importOrderNo} 存在多个不同订单备注，请统一后再导入`,
            {
              field: '订单备注',
              importOrderNo,
            }
          )
        );
        continue;
      }

      bucket.items.push(transformedItem);
      bucket.orderAmount = Number(
        (bucket.orderAmount + Number(transformedItem.subtotal ?? 0)).toFixed(2)
      );
      bucket.orderDate = bucket.orderDate || value.订单日期 || undefined;
      bucket.orderRemarks = bucket.orderRemarks || value.订单备注 || undefined;
      bucket.previewRows.push(
        buildImportPreviewRow({
          customerName,
          importOrderNo,
          orderDate: bucket.orderDate || effectiveOrderDate,
          orderRemarks: bucket.orderRemarks,
          product,
          row: rowNumber,
          rowData: value,
          transformedItem,
        })
      );
      bucket.rowNumbers.push(rowNumber);
    }

    buckets.forEach(bucket => {
      if (bucket.importOrderNoSource === 'generated') {
        bucket.importOrderNo = buildDeterministicImportOrderNo(bucket);
        bucket.previewRows = bucket.previewRows.map(row => ({
          ...row,
          importOrderNo: bucket.importOrderNo,
        }));
      }
    });

    const existingImportedOrderNumbers = await loadExistingImportedOrderNumbers(
      prisma,
      Array.from(
        new Set(
          Array.from(buckets.values()).map(bucket => bucket.importOrderNo)
        )
      )
    );

    buckets.forEach(bucket => {
      const existingOrderNumber = existingImportedOrderNumbers.get(
        bucket.importOrderNo
      );

      if (!existingOrderNumber) {
        return;
      }

      duplicateOrders.push({
        row: bucket.rowNumbers[0] ?? 0,
        importOrderNo: bucket.importOrderNo,
        source: 'system',
        existingOrderNumber,
        message: `导入单号 ${bucket.importOrderNo} 已导入过，系统订单号为 ${existingOrderNumber}`,
      });
    });
  }

  const duplicateImportOrderNos = new Set(
    duplicateOrders.map(duplicate => duplicate.importOrderNo)
  );

  buckets.forEach(bucket => {
    if (
      invalidImportOrderNos.has(bucket.importOrderNo) ||
      duplicateImportOrderNos.has(bucket.importOrderNo)
    ) {
      return;
    }

    validatePreparedOrderBucket(bucket, errors, invalidImportOrderNos);
  });

  const importableOrders = Array.from(buckets.values()).filter(bucket => {
    if (invalidImportOrderNos.has(bucket.importOrderNo)) {
      return false;
    }

    return !duplicateImportOrderNos.has(bucket.importOrderNo);
  });

  const previewRows = importableOrders.flatMap(bucket => bucket.previewRows);
  const totalOrderCount = new Set(
    parsedRows.map(entry => entry.resolvedImportOrderNo)
  ).size;

  const validation = {
    valid: errors.length === 0 && importableOrders.length > 0,
    totalRowCount: rows.length,
    totalOrderCount,
    validOrderCount: importableOrders.length,
    autoCreateCustomerNames: Array.from(autoCreateCustomerNames).sort((a, b) =>
      a.localeCompare(b, 'zh-CN')
    ),
    duplicateOrderCount: duplicateOrders.length,
    errorCount: errors.length,
    previewRows,
    duplicates: duplicateOrders,
    errors,
  } satisfies SalesOrderImportValidationResult;

  return {
    importableOrders,
    validation,
  };
}

export async function validateSalesOrderImportRows(
  rows: unknown[],
  options: SalesOrderImportExecutionOptions = {}
) {
  normalizeSalesOrderImportOptions(options);
  const prepared = await prepareSalesOrderImport(rows);
  return prepared.validation;
}

function resolveImportedOrderDate(order: OrderBucket) {
  return (
    parseLocalDateString(order.orderDate || getTodayDateString()) ?? new Date()
  );
}

function resolveImportedShippedAt(
  order: OrderBucket,
  options: ReturnType<typeof normalizeSalesOrderImportOptions>
) {
  if (options.targetStatus !== 'shipped') {
    return undefined;
  }

  const candidate =
    options.shippedDate || order.orderDate || getTodayDateString();
  const parsed = parseLocalDateString(candidate);
  if (!parsed) {
    throw new Error('统一发货日期格式不正确，请使用 YYYY-MM-DD');
  }
  return parsed;
}

export async function importSalesOrdersFromRows(
  rows: unknown[],
  userId: string,
  options: SalesOrderImportExecutionOptions = {}
): Promise<SalesOrderImportExecutionResult> {
  const normalizedOptions = normalizeSalesOrderImportOptions(options);
  const prepared = await prepareSalesOrderImport(rows);
  const importableOrders = [...prepared.importableOrders].sort(
    (left, right) => {
      const leftOrderDate = left.orderDate || getTodayDateString();
      const rightOrderDate = right.orderDate || getTodayDateString();

      if (leftOrderDate !== rightOrderDate) {
        return leftOrderDate.localeCompare(rightOrderDate, 'zh-CN');
      }

      return (left.rowNumbers[0] ?? 0) - (right.rowNumbers[0] ?? 0);
    }
  );

  if (prepared.validation.errorCount > 0 || importableOrders.length === 0) {
    return {
      ...prepared.validation,
      valid: false,
      importedCount: 0,
      importedOrders: [],
    };
  }

  const importOrderNos = Array.from(
    new Set(importableOrders.map(order => order.importOrderNo))
  );

  try {
    const transactionResult = await prisma.$transaction(async tx => {
      const existingImportedOrderNumbers =
        await loadExistingImportedOrderNumbers(tx, importOrderNos);

      const runtimeDuplicates = importableOrders
        .filter(order => existingImportedOrderNumbers.has(order.importOrderNo))
        .map(order => ({
          row: order.rowNumbers[0] ?? 0,
          importOrderNo: order.importOrderNo,
          source: 'system' as const,
          existingOrderNumber: existingImportedOrderNumbers.get(
            order.importOrderNo
          ),
          message: `导入单号 ${order.importOrderNo} 已导入过，系统订单号为 ${existingImportedOrderNumbers.get(order.importOrderNo)}`,
        }));

      if (runtimeDuplicates.length > 0) {
        return {
          importedOrders:
            [] as SalesOrderImportExecutionResult['importedOrders'],
          runtimeDuplicates,
        };
      }

      const importedOrders: SalesOrderImportExecutionResult['importedOrders'] =
        [];

      for (const order of importableOrders) {
        try {
          const customer =
            order.customerId && order.customerId.trim()
              ? {
                  id: order.customerId,
                  name: order.customerName,
                }
              : await findOrCreateCustomerByName(tx, order.customerName);
          const createdOrder = await createSalesOrderWithOptions(
            {
              customerId: customer.id,
              status: IMPORT_TARGET_STATUS,
              orderType: 'NORMAL',
              orderDate: order.orderDate || undefined,
              remarks: normalizeImportedOrderRemarks(order.orderRemarks),
              items: order.items,
            },
            userId,
            {
              dataTag: IMPORT_TARGET_DATA_TAG,
              importKey: order.importOrderNo,
              pendingPaymentDate: resolveImportedOrderDate(order),
              tx,
            }
          );

          if (normalizedOptions.targetStatus === 'shipped') {
            await updateSalesOrderStatus(
              createdOrder.id,
              'shipped',
              'confirmed',
              undefined,
              userId,
              {
                shippedAt: resolveImportedShippedAt(order, normalizedOptions),
                tx,
              }
            );
          }

          importedOrders.push({
            id: createdOrder.id,
            orderNumber: createdOrder.orderNumber,
            importOrderNo: order.importOrderNo,
            customerName: customer.name,
            totalAmount: Number(createdOrder.totalAmount ?? order.orderAmount),
          });
        } catch (error) {
          if (isImportKeyUniqueConstraintError(error)) {
            throw createImportExecutionAbort({
              kind: 'duplicate',
              duplicate: {
                row: order.rowNumbers[0] ?? 0,
                importOrderNo: order.importOrderNo,
                source: 'system',
                message: `导入单号 ${order.importOrderNo} 已导入过，请刷新后重试`,
              },
            });
          }

          throw createImportExecutionAbort({
            kind: 'error',
            error: createImportError(
              order.rowNumbers[0] ?? 0,
              error instanceof Error ? error.message : '销售记录导入失败',
              {
                importOrderNo: order.importOrderNo,
              }
            ),
          });
        }
      }

      return {
        importedOrders,
        runtimeDuplicates: [] as SalesOrderImportDuplicate[],
      };
    }, getLongTransactionOptions());

    if (transactionResult.runtimeDuplicates.length > 0) {
      const duplicates = [
        ...prepared.validation.duplicates,
        ...transactionResult.runtimeDuplicates,
      ];

      return {
        ...prepared.validation,
        valid: false,
        duplicateOrderCount: duplicates.length,
        duplicates,
        importedCount: 0,
        importedOrders: [],
      };
    }

    return {
      ...prepared.validation,
      valid: transactionResult.importedOrders.length > 0,
      importedCount: transactionResult.importedOrders.length,
      importedOrders: transactionResult.importedOrders,
    };
  } catch (error) {
    const executionErrors = [...prepared.validation.errors];
    const duplicates = [...prepared.validation.duplicates];

    if (isDuplicateImportExecutionAbort(error)) {
      duplicates.push(error.duplicate);

      return {
        ...prepared.validation,
        valid: false,
        duplicateOrderCount: duplicates.length,
        duplicates,
        importedCount: 0,
        importedOrders: [],
      };
    }

    if (isErrorImportExecutionAbort(error)) {
      executionErrors.push(error.error);
    } else if (
      error &&
      typeof error === 'object' &&
      'row' in error &&
      'message' in error &&
      typeof (error as SalesOrderImportError).row === 'number'
    ) {
      executionErrors.push(error as SalesOrderImportError);
    } else {
      executionErrors.push(
        createImportError(
          0,
          error instanceof Error ? error.message : '销售记录导入失败'
        )
      );
    }

    return {
      ...prepared.validation,
      valid: false,
      errorCount: executionErrors.length,
      errors: executionErrors,
      importedCount: 0,
      importedOrders: [],
    };
  }
}

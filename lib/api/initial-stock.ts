import { queryKeys } from '@/lib/queryKeys';
import type { ApiResponse } from '@/lib/types/api';
import { csrfFetch } from '@/lib/utils/csrf';

export interface InitialStockImportPreviewRow {
  row: number;
  productCode: string;
  productName: string;
  specification: string;
  colorCode?: string;
  batchNumber: string;
  inputQuantity: number;
  quantityUnit: '片' | '件';
  quantityUnitSource: 'row' | 'default';
  piecesPerUnit?: number;
  piecesPerUnitSource?: 'row' | 'product';
  weight?: number;
  weightSource?: 'row' | 'product';
  quantity: number;
  unitCost: number;
  supplierName?: string;
  location?: string;
  matchMethod: string;
}

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

export interface InitialStockImportResult {
  valid: boolean;
  canImport: boolean;
  totalCount: number;
  validCount: number;
  duplicateCount: number;
  errorCount: number;
  previewRows: InitialStockImportPreviewRow[];
  duplicates: InitialStockImportDuplicate[];
  errors: InitialStockImportError[];
  importedCount?: number;
  importBatchId?: string;
}

export interface OpeningBalanceImportBatchRecord {
  id: string;
  recordNumber: string;
  productId: string;
  productCode: string;
  productName: string;
  specification?: string;
  variantId?: string;
  colorCode?: string;
  colorName?: string;
  batchNumber?: string;
  openingImportBatchId: string;
  quantity: number;
  piecesPerUnit: number;
  unitCost?: number;
  totalCost?: number;
  location?: string;
  supplierName?: string;
  createdAt: string;
  updatedAt: string;
  canCorrect: boolean;
  canDelete: boolean;
  correctionMode: 'full' | 'decrease_only' | 'blocked';
  consumedQty: number;
  inventoryQuantity?: number;
  inventoryAvailableQty?: number;
  blockedReason?: string;
  warningMessage?: string;
}

export interface OpeningBalanceImportBatchDetail {
  batchId: string;
  totalCount: number;
  canDeleteAll: boolean;
  canCorrectAny: boolean;
  blockedCount: number;
  importStartedAt: string;
  importEndedAt: string;
  records: OpeningBalanceImportBatchRecord[];
}

export interface OpeningBalanceImportBatchCorrectionResult {
  batchId: string;
  totalRequested: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  productIds: string[];
  results: Array<{
    id: string;
    recordNumber?: string;
    status: 'updated' | 'skipped' | 'failed';
    message: string;
  }>;
}

export interface OpeningBalanceImportBatchDeleteResult {
  batchId: string;
  deletedCount: number;
  productIds: string[];
  deletedRecordNumbers: string[];
}

export const initialStockQueryKeys = queryKeys.inventory;

function parseFilenameFromContentDisposition(headerValue: string | null) {
  if (!headerValue) {
    return '期初库存导入模板.xlsx';
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const asciiMatch = headerValue.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] || '期初库存导入模板.xlsx';
}

export async function downloadInitialStockImportTemplate(
  source: 'blank' | 'products' = 'blank'
): Promise<{
  blob: Blob;
  filename: string;
}> {
  const searchParams = new URLSearchParams();
  if (source === 'products') {
    searchParams.set('source', 'products');
  }

  const response = await fetch(
    `/api/inventory/initial-stock/template?${searchParams.toString()}`,
    {
      method: 'GET',
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error('下载期初库存导入模板失败');
  }

  return {
    blob: await response.blob(),
    filename: parseFilenameFromContentDisposition(
      response.headers.get('content-disposition')
    ),
  };
}

async function sendInitialStockImportRequest(
  file: File,
  mode: 'dry-run' | 'import'
): Promise<InitialStockImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);

  const response = await csrfFetch('/api/inventory/initial-stock/import', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  const body = (await response.json()) as ApiResponse<InitialStockImportResult>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '期初库存导入失败');
  }

  return body.data;
}

export function previewInitialStockImport(file: File) {
  return sendInitialStockImportRequest(file, 'dry-run');
}

export function importInitialStock(file: File) {
  return sendInitialStockImportRequest(file, 'import');
}

export async function getOpeningBalanceImportBatchDetail(
  batchId: string
): Promise<OpeningBalanceImportBatchDetail> {
  const response = await fetch(
    `/api/inventory/opening-balance-batches/${encodeURIComponent(batchId)}`,
    {
      credentials: 'include',
    }
  );

  const body =
    (await response.json()) as ApiResponse<OpeningBalanceImportBatchDetail>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '获取导入批次详情失败');
  }

  return body.data;
}

export async function correctOpeningBalanceImportBatch(params: {
  batchId: string;
  corrections: Array<{
    id: string;
    quantity: number;
    unitCost?: number;
  }>;
}): Promise<OpeningBalanceImportBatchCorrectionResult> {
  const response = await csrfFetch(
    `/api/inventory/opening-balance-batches/${encodeURIComponent(params.batchId)}/correct`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        corrections: params.corrections,
      }),
    }
  );

  const body =
    (await response.json()) as ApiResponse<OpeningBalanceImportBatchCorrectionResult>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '按导入批次批量更正失败');
  }

  return body.data;
}

export async function deleteOpeningBalanceImportBatch(
  batchId: string
): Promise<OpeningBalanceImportBatchDeleteResult> {
  const response = await csrfFetch(
    `/api/inventory/opening-balance-batches/${encodeURIComponent(batchId)}/delete`,
    {
      method: 'POST',
    }
  );

  const body =
    (await response.json()) as ApiResponse<OpeningBalanceImportBatchDeleteResult>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error || '按导入批次批量删除失败');
  }

  return body.data;
}

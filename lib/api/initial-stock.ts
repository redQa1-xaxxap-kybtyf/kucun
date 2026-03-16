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
  quantity: number;
  unitCost: number;
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

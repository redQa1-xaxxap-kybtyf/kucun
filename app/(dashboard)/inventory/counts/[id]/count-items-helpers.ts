/**
 * 库存盘点明细相关辅助函数
 */

import { getInventories } from '@/lib/api/inventory';
import type { InventoryCountDetail } from '@/lib/types/inventory-count';
import type { InventoryQueryParams } from '@/lib/types/inventory-queries';
import { getCsrfTokenHeader } from '@/lib/utils/csrf';

const COUNT_ITEM_PAGE_SIZE = 100;

/**
 * 生成库存记录的唯一键
 */
export function generateInventoryKey(
  productId: string | null | undefined,
  variantId: string | null | undefined,
  batchNumber: string | null | undefined
): string {
  return `${productId || ''}::${variantId || ''}::${batchNumber || ''}`;
}

/**
 * 获取已存在的盘点明细键集合
 */
export function getExistingItemKeys(count: InventoryCountDetail): Set<string> {
  return new Set(
    (count.items || []).map(item =>
      generateInventoryKey(item.productId, item.variantId, item.batchNumber)
    )
  );
}

/**
 * 构建生成全部明细的查询参数
 */
export function buildGenerateAllParams(
  count: InventoryCountDetail
): InventoryQueryParams {
  const params: InventoryQueryParams = {
    page: 1,
    limit: COUNT_ITEM_PAGE_SIZE,
  };

  if (count.location) {
    params.location = count.location;
  }

  if (count.categoryId) {
    params.categoryId = count.categoryId;
  }

  return params;
}

/**
 * 构建添加产品明细的查询参数
 */
export function buildAddProductParams(
  count: InventoryCountDetail,
  productId: string
): InventoryQueryParams {
  const params: InventoryQueryParams = {
    page: 1,
    limit: COUNT_ITEM_PAGE_SIZE,
    productId,
    hasStock: true,
  };

  if (count.location) {
    params.location = count.location;
  }

  return params;
}

/**
 * 准备盘点明细的请求负载
 */
export interface InventoryRecord {
  productId: string;
  variantId?: string | null;
  batchNumber?: string | null;
  location?: string | null;
}

export function prepareItemsPayload(inventories: InventoryRecord[]) {
  return inventories.map(inv => ({
    productId: inv.productId,
    variantId: inv.variantId,
    batchNumber: inv.batchNumber,
    location: inv.location,
  }));
}

/**
 * 发送添加盘点明细的请求
 */
export async function addCountItems(
  countId: string,
  items: ReturnType<typeof prepareItemsPayload>
): Promise<Response> {
  return fetch(
    `/api/inventory/counts/${countId}/items`,
    getCsrfTokenHeader({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  );
}

/**
 * 处理 API 响应错误
 */
export async function handleApiError(
  response: Response,
  defaultMessage: string
): Promise<never> {
  const error = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    message?: unknown;
  };

  let message: string | undefined;

  // 兼容 { success: false, error: 'xxx' }
  if (typeof error.error === 'string' && error.error) {
    message = error.error;
  }

  // 兼容 { success: false, error: { message: 'xxx' } }
  if (!message && error.error && typeof error.error === 'object') {
    const nested = error.error as { message?: unknown };
    if (typeof nested.message === 'string' && nested.message) {
      message = nested.message;
    }
  }

  // 兼容 { message: 'xxx' }
  if (!message && typeof error.message === 'string' && error.message) {
    message = error.message;
  }

  throw new Error(message || defaultMessage);
}

/**
 * 按分页拉取全部库存记录，避免只取第一页导致漏盘
 */
export async function fetchAllInventoryRecords(
  params: InventoryQueryParams
): Promise<InventoryRecord[]> {
  const inventories: InventoryRecord[] = [];
  let currentPage = 1;
  let totalPages = 1;

  do {
    const response = await getInventories({
      ...params,
      page: currentPage,
      limit: params.limit ?? COUNT_ITEM_PAGE_SIZE,
    });

    inventories.push(...response.inventories);
    totalPages = response.pagination?.totalPages ?? 1;
    currentPage += 1;
  } while (currentPage <= totalPages);

  return inventories;
}

/**
 * 过滤出新的库存记录（不在已有明细中的）
 */
export function filterNewRecords(
  inventories: InventoryRecord[],
  existingKeys: Set<string>
): InventoryRecord[] {
  return inventories.filter(inv => {
    const key = generateInventoryKey(
      inv.productId,
      inv.variantId,
      inv.batchNumber
    );
    return !existingKeys.has(key);
  });
}

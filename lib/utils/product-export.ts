import {
  PRODUCT_STATUS_LABELS,
  PRODUCT_UNIT_LABELS,
} from '@/lib/config/product';
import type { Product } from '@/lib/types/product';
import { formatDateTime } from '@/lib/utils/datetime';

export const PRODUCT_EXPORT_PAGE_SIZE = 100;

export interface BuildProductExportRowsOptions {
  categoryPathById?: Map<string, string>;
}

export function buildProductExportFilename(now: Date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `产品列表_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function buildProductExportRows(
  products: Product[],
  options: BuildProductExportRowsOptions = {}
): Array<Record<string, unknown>> {
  const { categoryPathById } = options;

  return products.map(product => {
    const categoryPath =
      (product.category?.id
        ? categoryPathById?.get(product.category.id)
        : undefined) ??
      product.category?.name ??
      '';

    return {
      产品编码: product.code,
      产品名称: product.name,
      规格: product.specification ?? '',
      产品分类: categoryPath,
      分类编码: product.category?.code ?? '',
      计量单位: PRODUCT_UNIT_LABELS[product.unit] ?? product.unit,
      '厚度（mm）': product.thickness ?? '',
      状态: PRODUCT_STATUS_LABELS[product.status] ?? product.status,
      描述: product.description ?? '',
      创建时间: formatDateTime(product.createdAt),
      更新时间: formatDateTime(product.updatedAt),
    };
  });
}

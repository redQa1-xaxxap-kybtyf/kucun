import type { InventoryCountItem } from '@/lib/types/inventory-count';
import { ProductDataUtils } from '@/lib/utils/product-data';

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').trim().toLocaleLowerCase('zh-CN');
}

function compareText(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return (a ?? '').localeCompare(b ?? '', 'zh-CN');
}

export function getInventoryCountItemPiecesPerUnit(
  item: Pick<InventoryCountItem, 'batchSpecification' | 'product'>
): number {
  return (
    item.batchSpecification?.piecesPerUnit ?? item.product?.piecesPerUnit ?? 0
  );
}

export function getInventoryCountItemSpecification(
  item: Pick<InventoryCountItem, 'variant' | 'product'>
): string {
  const variantLabel =
    item.variant &&
    `${item.variant.colorName || ''} ${item.variant.sku || ''}`.trim();

  if (variantLabel) {
    return variantLabel;
  }

  return ProductDataUtils.formatter.formatSpecification(
    item.product?.specification
  );
}

export function compareInventoryCountItems(
  a: InventoryCountItem,
  b: InventoryCountItem
): number {
  const comparisons = [
    compareText(a.product?.name, b.product?.name),
    compareText(a.product?.code, b.product?.code),
    compareText(
      getInventoryCountItemSpecification(a),
      getInventoryCountItemSpecification(b)
    ),
    compareText(a.batchNumber, b.batchNumber),
    compareText(a.location, b.location),
  ];

  return comparisons.find(value => value !== 0) ?? 0;
}

export function matchesInventoryCountItemSearch(
  item: InventoryCountItem,
  keyword: string
): boolean {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return true;
  }

  return [
    item.product?.name,
    item.product?.code,
    item.batchNumber,
    item.location,
    getInventoryCountItemSpecification(item),
  ].some(value => normalizeText(value).includes(normalizedKeyword));
}

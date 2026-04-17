import type { Inventory } from '@/lib/types/inventory';
import { PRODUCT_UNIT_LABELS } from '@/lib/types/product';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { formatPieceSummary } from '@/lib/utils/piece-calculation';

export const INVENTORY_EXPORT_PAGE_SIZE = 100;

export interface BuildInventoryExportRowsOptions {
  includeFinance?: boolean;
  categoryPathById?: Map<string, string>;
}

function resolveUnitLabel(inventory: Inventory): string {
  const rawUnit = inventory.product?.unit;
  if (!rawUnit) {
    return '片';
  }

  return PRODUCT_UNIT_LABELS[rawUnit] ?? rawUnit;
}

export function buildInventoryExportFilename(now: Date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, '0');

  return `库存总览_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function buildInventoryExportRows(
  inventories: Inventory[],
  options: BuildInventoryExportRowsOptions = {}
): Array<Record<string, unknown>> {
  const { includeFinance = false, categoryPathById } = options;

  return inventories.map(inventory => {
    const packaging =
      inventory.batchPiecesPerUnit ?? inventory.product?.piecesPerUnit ?? 0;
    const unitLabel = resolveUnitLabel(inventory);
    const availableQuantity = Math.max(
      inventory.quantity - (inventory.reservedQuantity ?? 0),
      0
    );
    const categoryPath =
      (inventory.product?.category?.id
        ? categoryPathById?.get(inventory.product.category.id)
        : undefined) ??
      inventory.product?.category?.name ??
      '';

    const row: Record<string, unknown> = {
      产品编码: inventory.product?.code ?? '未知编码',
      产品名称: inventory.product?.name ?? '未知产品',
      规格: inventory.product?.specification ?? '',
      分类: categoryPath,
      批次: inventory.batchNumber ?? '常规',
      库位: inventory.location ?? '',
      单位: unitLabel,
      '装箱数（片/件）': packaging > 0 ? packaging : '',
      '重量（kg）': inventory.weight ?? '',
      '总库存（片）': inventory.quantity,
      '总库存（件片）': formatPieceSummary(inventory.quantity, packaging, {
        fallbackUnit: unitLabel,
      }),
      '预留（片）': inventory.reservedQuantity ?? 0,
      '预留（件片）': formatPieceSummary(
        inventory.reservedQuantity ?? 0,
        packaging,
        {
          fallbackUnit: unitLabel,
          zeroDisplay: `0${unitLabel}`,
        }
      ),
      '可用（片）': availableQuantity,
      '可用（件片）': formatPieceSummary(availableQuantity, packaging, {
        fallbackUnit: unitLabel,
        zeroDisplay: `0${unitLabel}`,
      }),
      最后更新: formatDate(inventory.updatedAt, 'datetime'),
    };

    if (!includeFinance) {
      return row;
    }

    row['单位成本'] =
      inventory.unitCost !== null && inventory.unitCost !== undefined
        ? inventory.unitCost
        : '';
    row['单位成本展示'] =
      inventory.unitCost !== null && inventory.unitCost !== undefined
        ? formatCurrency(inventory.unitCost, 3)
        : '';
    row['库存货值（元）'] =
      inventory.unitCost !== null && inventory.unitCost !== undefined
        ? Number((inventory.quantity * inventory.unitCost).toFixed(2))
        : '';

    return row;
  });
}

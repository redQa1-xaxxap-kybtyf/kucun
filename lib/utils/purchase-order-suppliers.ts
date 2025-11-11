import type { PurchaseOrderItem } from '@/lib/types/purchase-order';

/**
 * 聚合显示采购订单的供应商信息
 * - 单供应商: 显示供应商名称
 * - 2个供应商: "供应商A、供应商B"
 * - 3+供应商: "供应商A、供应商B +N个"
 */
export function formatPurchaseOrderSuppliers(
  items: Pick<PurchaseOrderItem, 'supplierId' | 'supplier' | 'totalPrice'>[]
): string {
  if (!items || items.length === 0) {
    return '-';
  }

  // 按供应商ID分组,统计金额
  const supplierMap = new Map<
    string,
    { name: string; amount: number }
  >();

  for (const item of items) {
    if (!item.supplierId || !item.supplier) {
      continue;
    }

    const existing = supplierMap.get(item.supplierId);
    if (existing) {
      existing.amount += item.totalPrice;
    } else {
      supplierMap.set(item.supplierId, {
        name: item.supplier.name,
        amount: item.totalPrice,
      });
    }
  }

  if (supplierMap.size === 0) {
    return '-';
  }

  // 按金额降序排序(主要供应商在前)
  const suppliers = Array.from(supplierMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  if (suppliers.length === 1) {
    // 单供应商
    return suppliers[0].name;
  }

  if (suppliers.length === 2) {
    // 2个供应商
    return `${suppliers[0].name}、${suppliers[1].name}`;
  }

  // 3+供应商
  return `${suppliers[0].name}、${suppliers[1].name} +${suppliers.length - 2}个`;
}

/**
 * 获取采购订单的主要供应商(按金额最大)
 */
export function getPrimarySupplier(
  items: Pick<PurchaseOrderItem, 'supplierId' | 'supplier' | 'totalPrice'>[]
): { id: string; name: string } | null {
  if (!items || items.length === 0) {
    return null;
  }

  const supplierMap = new Map<
    string,
    { name: string; amount: number }
  >();

  for (const item of items) {
    if (!item.supplierId || !item.supplier) {
      continue;
    }

    const existing = supplierMap.get(item.supplierId);
    if (existing) {
      existing.amount += item.totalPrice;
    } else {
      supplierMap.set(item.supplierId, {
        name: item.supplier.name,
        amount: item.totalPrice,
      });
    }
  }

  if (supplierMap.size === 0) {
    return null;
  }

  // 找金额最大的供应商
  const [primaryId, primaryData] = Array.from(supplierMap.entries()).reduce(
    (max, current) => (current[1].amount > max[1].amount ? current : max)
  );

  return {
    id: primaryId,
    name: primaryData.name,
  };
}

/**
 * 获取采购订单的所有唯一供应商
 */
export function getUniqueSuppliers(
  items: Pick<PurchaseOrderItem, 'supplierId' | 'supplier'>[]
): Array<{ id: string; name: string }> {
  if (!items || items.length === 0) {
    return [];
  }

  const supplierMap = new Map<string, string>();

  for (const item of items) {
    if (item.supplierId && item.supplier) {
      supplierMap.set(item.supplierId, item.supplier.name);
    }
  }

  return Array.from(supplierMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
}

import { prisma } from '@/lib/db';

/**
 * 标准化供应商名称
 * 去除前后空格，转换为小写，处理特殊字符
 */
export function normalizeSupplierName(name: string): string {
  return name
    .trim() // 去除前后空格
    .toLowerCase() // 转换为小写
    .replace(/\s+/g, ' ') // 多个空格替换为单个空格
    .replace(/[^\w\s\u4e00-\u9fff\-]/g, '') // 只保留字母、数字、中文、空格和横线
    .trim(); // 再次去除可能产生的前后空格
}

/**
 * 生成供应商编码
 * 格式：SUP + 年月日 + 3位序号
 */
export async function generateSupplierCode(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `SUP${dateStr}`;

  // 查找当天最大的序号
  const lastSupplier = await prisma.supplier.findFirst({
    where: {
      supplierCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      supplierCode: 'desc',
    },
    select: {
      supplierCode: true,
    },
  });

  let sequence = 1;
  if (lastSupplier?.supplierCode) {
    const lastSequence = parseInt(
      lastSupplier.supplierCode.slice(prefix.length),
      10
    );
    if (!isNaN(lastSequence)) {
      sequence = lastSequence + 1;
    }
  }

  return `${prefix}${sequence.toString().padStart(3, '0')}`;
}

/**
 * 验证供应商名称唯一性
 */
export async function validateSupplierNameUniqueness(
  name: string,
  excludeId?: string
): Promise<{
  isUnique: boolean;
  conflictSupplier?: { id: string; name: string };
}> {
  const normalizedName = normalizeSupplierName(name);

  const existingSupplier = await prisma.supplier.findFirst({
    where: {
      name: normalizedName,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    isUnique: !existingSupplier,
    conflictSupplier: existingSupplier || undefined,
  };
}

/**
 * 验证供应商编码唯一性
 */
export async function validateSupplierCodeUniqueness(
  code: string,
  excludeId?: string
): Promise<{
  isUnique: boolean;
  conflictSupplier?: { id: string; name: string };
}> {
  if (!code) {
    return { isUnique: true };
  }

  const existingSupplier = await prisma.supplier.findFirst({
    where: {
      supplierCode: code,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    isUnique: !existingSupplier,
    conflictSupplier: existingSupplier || undefined,
  };
}

/**
 * 检查供应商是否被其他业务数据引用
 */
export async function checkSupplierReferences(supplierId: string): Promise<{
  hasReferences: boolean;
  references: {
    salesOrders: number;
    factoryShipmentItems: number;
  };
}> {
  const [salesOrderCount, factoryShipmentItemCount] = await Promise.all([
    prisma.salesOrder.count({
      where: { supplierId },
    }),
    prisma.factoryShipmentOrderItem.count({
      where: { supplierId },
    }),
  ]);

  const references = {
    salesOrders: salesOrderCount,
    factoryShipmentItems: factoryShipmentItemCount,
  };

  return {
    hasReferences: salesOrderCount > 0 || factoryShipmentItemCount > 0,
    references,
  };
}

/**
 * 格式化供应商引用错误信息
 */
export function formatSupplierReferenceError(references: {
  salesOrders: number;
  factoryShipmentItems: number;
}): string {
  const messages: string[] = [];

  if (references.salesOrders > 0) {
    messages.push(`${references.salesOrders}个销售订单`);
  }

  if (references.factoryShipmentItems > 0) {
    messages.push(`${references.factoryShipmentItems}个厂家发货项目`);
  }

  return `该供应商正在被${messages.join('、')}引用，无法删除。请先处理相关业务数据。`;
}

/**
 * 批量检查供应商引用
 * 优化：使用批量查询避免 N+1 问题
 */
export async function batchCheckSupplierReferences(
  supplierIds: string[]
): Promise<{
  canDelete: string[];
  cannotDelete: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
}> {
  const canDelete: string[] = [];
  const cannotDelete: Array<{ id: string; name: string; reason: string }> = [];

  // 批量查询所有供应商信息（避免 N+1 查询）
  const suppliers = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true },
  });

  // 创建供应商映射
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));

  // 批量查询所有供应商的引用计数（避免 N+1 查询）
  const [salesOrderCounts, factoryShipmentItemCounts] = await Promise.all([
    prisma.salesOrder.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds } },
      _count: { id: true },
    }),
    prisma.factoryShipmentOrderItem.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds } },
      _count: { id: true },
    }),
  ]);

  // 创建引用计数映射
  const salesOrderCountMap = new Map(
    salesOrderCounts.map(item => [item.supplierId, item._count.id])
  );
  const factoryShipmentItemCountMap = new Map(
    factoryShipmentItemCounts.map(item => [item.supplierId, item._count.id])
  );

  // 检查每个供应商
  for (const supplierId of supplierIds) {
    const supplier = supplierMap.get(supplierId);

    if (!supplier) {
      cannotDelete.push({
        id: supplierId,
        name: '未知供应商',
        reason: '供应商不存在',
      });
      continue;
    }

    const salesOrderCount = salesOrderCountMap.get(supplierId) || 0;
    const factoryShipmentItemCount =
      factoryShipmentItemCountMap.get(supplierId) || 0;

    const hasReferences = salesOrderCount > 0 || factoryShipmentItemCount > 0;

    if (hasReferences) {
      const references = {
        salesOrders: salesOrderCount,
        factoryShipmentItems: factoryShipmentItemCount,
      };
      cannotDelete.push({
        id: supplierId,
        name: supplier.name,
        reason: formatSupplierReferenceError(references),
      });
    } else {
      canDelete.push(supplierId);
    }
  }

  return { canDelete, cannotDelete };
}

/**
 * 清理供应商数据
 * 将空字符串转换为 null，标准化名称等
 */
export function cleanSupplierData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      cleaned[key] = trimmed === '' ? null : trimmed;
    } else {
      cleaned[key] = value;
    }
  }

  // 如果有名称，添加标准化名称
  if (cleaned.name && typeof cleaned.name === 'string') {
    cleaned.normalizedName = normalizeSupplierName(cleaned.name);
  }

  return cleaned;
}

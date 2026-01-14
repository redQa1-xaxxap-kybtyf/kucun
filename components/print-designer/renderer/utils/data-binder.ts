/**
 * 打印设计器 - 数据绑定工具
 *
 * 用于从业务数据中提取字段值
 */

/**
 * 安全获取嵌套属性值
 *
 * @param obj - 源对象
 * @param path - 属性路径 (如 'order.customer.name')
 * @returns 属性值，未找到返回 undefined
 *
 * @example
 * getNestedValue({ order: { no: 'SO-001' } }, 'order.no') // 'SO-001'
 * getNestedValue({ items: [{ name: 'A' }] }, 'items.0.name') // 'A'
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined || !path) {
    return undefined;
  }

  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

/**
 * 检查路径是否存在值
 */
export function hasNestedValue(obj: unknown, path: string): boolean {
  return getNestedValue(obj, path) !== undefined;
}

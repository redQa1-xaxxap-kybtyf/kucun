/**
 * URL构建器
 *
 * 负责将参数对象序列化为URLSearchParams
 * 处理默认值、空值、特殊类型的序列化
 */

import type { ParamConfig, SerializeOptions } from './types';

/**
 * 将参数对象序列化为URLSearchParams
 *
 * @param params - 参数对象
 * @param configs - 参数配置
 * @param options - 序列化选项
 * @returns URLSearchParams对象
 */
export function serializeToUrlParams<T extends object>(
  params: T,
  configs: Record<keyof T, ParamConfig>,
  options: SerializeOptions = {}
): URLSearchParams {
  const { includeDefaults = false, encodeUri = true } = options;
  const urlParams = new URLSearchParams();

  for (const key of Object.keys(params) as Array<keyof T>) {
    const config = configs[key];
    const value = params[key];

    // 跳过undefined和null
    if (value === undefined || value === null) {
      continue;
    }

    // 当配置缺失时，采用字符串兜底逻辑
    if (!config) {
      const fallbackValue = Array.isArray(value)
        ? value.join(',')
        : String(value);
      if (fallbackValue.length > 0) {
        if (encodeUri) {
          urlParams.set(key as string, fallbackValue);
        } else {
          urlParams.append(key as string, fallbackValue);
        }
      }
      continue;
    }

    // 跳过默认值(除非明确要求包含)
    if (!includeDefaults && value === config.default) {
      continue;
    }

    // 根据类型序列化值
    const serialized = serializeValue(value, config);

    if (serialized !== null) {
      if (encodeUri) {
        urlParams.set(key as string, serialized);
      } else {
        // 不编码,直接设置
        urlParams.append(key as string, serialized);
      }
    }
  }

  return urlParams;
}

/**
 * 序列化单个参数值
 */
function serializeValue(value: unknown, config: ParamConfig): string | null {
  switch (config.type) {
    case 'string':
      // 字符串: 空字符串不添加到URL(除非是默认值)
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
      return null;

    case 'number':
      // 数字: 始终转换为字符串
      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value.toString();
      }
      return null;

    case 'boolean':
      // 布尔: 只有true才添加到URL (false等同于不存在)
      if (value === true) {
        return 'true';
      }
      return null;

    case 'enum':
      // 枚举: 验证后转换为字符串
      if (config.values?.includes(value)) {
        return String(value);
      }
      return null;

    case 'array': {
      // 数组: 使用分隔符连接
      if (Array.isArray(value) && value.length > 0) {
        const separator = config.separator || ',';
        return value.join(separator);
      }
      return null;
    }

    default:
      return String(value);
  }
}

/**
 * 构建完整的查询字符串
 *
 * @param params - 参数对象
 * @param configs - 参数配置
 * @param options - 序列化选项
 * @returns 查询字符串 (不包含"?")
 */
export function buildQueryString<T extends object>(
  params: T,
  configs: Record<keyof T, ParamConfig>,
  options?: SerializeOptions
): string {
  const urlParams = serializeToUrlParams(params, configs, options);
  return urlParams.toString();
}

/**
 * 构建完整的URL
 *
 * @param basePath - 基础路径 (如 "/sales-orders")
 * @param params - 参数对象
 * @param configs - 参数配置
 * @param options - 序列化选项
 * @returns 完整URL
 */
export function buildFullUrl<T extends object>(
  basePath: string,
  params: T,
  configs: Record<keyof T, ParamConfig>,
  options?: SerializeOptions
): string {
  const queryString = buildQueryString(params, configs, options);

  if (queryString.length === 0) {
    return basePath;
  }

  return `${basePath}?${queryString}`;
}

/**
 * 合并参数对象
 *
 * 智能合并,保留非undefined的值
 *
 * @param current - 当前参数
 * @param updates - 更新的参数
 * @returns 合并后的参数
 */
export function mergeParams<T extends object>(
  current: T,
  updates: Partial<T>
): T {
  const result = { ...current };

  for (const key of Object.keys(updates) as Array<keyof T>) {
    const value = updates[key];

    // undefined表示删除该参数
    if (value === undefined) {
      delete result[key];
    } else {
      // 赋值保留 T 的键类型
      result[key] = value as T[typeof key];
    }
  }

  return result;
}

/**
 * 比较两个参数对象是否相等
 *
 * @param a - 参数对象A
 * @param b - 参数对象B
 * @returns 是否相等
 */
export function areParamsEqual<T extends object>(
  a: T,
  b: T
): boolean {
  const keysA = Object.keys(a) as Array<keyof T>;
  const keysB = Object.keys(b) as Array<keyof T>;

  // 键数量不同
  if (keysA.length !== keysB.length) {
    return false;
  }

  // 逐个比较值
  for (const key of keysA) {
    const valueA = a[key];
    const valueB = b[key];

    // 处理数组比较
    if (Array.isArray(valueA) && Array.isArray(valueB)) {
      if (valueA.length !== valueB.length) {
        return false;
      }
      if (!valueA.every((v, i) => v === valueB[i])) {
        return false;
      }
      continue;
    }

    // 普通值比较
    if (valueA !== valueB) {
      return false;
    }
  }

  return true;
}

/**
 * 从查询字符串解析参数
 *
 * @param queryString - 查询字符串 (可以包含"?")
 * @returns URLSearchParams对象
 */
export function parseQueryString(queryString: string): URLSearchParams {
  // 移除开头的"?"
  const cleanQuery = queryString.startsWith('?')
    ? queryString.slice(1)
    : queryString;

  return new URLSearchParams(cleanQuery);
}

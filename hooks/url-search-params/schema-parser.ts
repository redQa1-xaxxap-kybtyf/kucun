/**
 * Schema解析器
 *
 * 负责将Zod schema或简化配置对象解析为统一的参数配置
 * 支持类型验证、默认值处理、值转换
 */

import type { ParamConfig, ParamSchema, ValidationResult } from './types';

/**
 * 检查是否为Zod Schema
 */
function isZodSchema(schema: any): schema is {
  safeParse: (input: unknown) => { success: true; data: unknown } | { success: false; error: any };
  parse: (input: unknown) => unknown;
  shape?: Record<string, unknown>;
} {
  return (
    !!schema &&
    typeof schema === 'object' &&
    typeof schema.safeParse === 'function' &&
    typeof schema.parse === 'function' &&
    'shape' in schema
  );
}

/**
 * 从Zod Schema提取参数配置
 */
function extractFromZodSchema<T extends Record<string, any>>(
  schema: {
    shape?: Record<string, unknown>;
  }
): Record<keyof T, ParamConfig> {
  const configs: Record<string, ParamConfig> = {};
  const shape = schema.shape ?? {};

  for (const key in shape) {
    const field = shape[key];
    configs[key] = parseZodField(field);
  }

  return configs as Record<keyof T, ParamConfig>;
}

/**
 * 解析Zod字段类型
 */
function parseZodField(field: any): ParamConfig {
  let innerType = field as any;
  let isOptional = false;
  let defaultValue: unknown = undefined;

  // 处理optional/nullable/default包装
  while (
    innerType &&
    typeof innerType === 'object' &&
    innerType._def &&
    typeof innerType._def === 'object' &&
    typeof innerType._def.type === 'string' &&
    (innerType._def.type === 'optional' ||
      innerType._def.type === 'nullable' ||
      innerType._def.type === 'default')
  ) {
    const def = innerType._def as any;

    if (def.type === 'default') {
      const defaultValueOrFn = def.defaultValue;
      defaultValue =
        typeof defaultValueOrFn === 'function'
          ? defaultValueOrFn()
          : defaultValueOrFn;
    }

    if (def.type === 'optional' || def.type === 'nullable') {
      isOptional = true;
    }

    isOptional = true;
    innerType = def.innerType;
  }

  const def = innerType?._def;

  // 字符串类型
  if (def?.type === 'string') {
    return {
      type: 'string',
      default: defaultValue ?? (isOptional ? undefined : ''),
    };
  }

  // 数字类型
  if (def?.type === 'number') {
    return {
      type: 'number',
      default: defaultValue ?? (isOptional ? undefined : 1),
    };
  }

  // 布尔类型
  if (def?.type === 'boolean') {
    return {
      type: 'boolean',
      default: defaultValue ?? (isOptional ? undefined : false),
    };
  }

  // 枚举类型
  if (def?.type === 'enum') {
    const entries = (def as any).entries;
    const values = Array.isArray(innerType?.options)
      ? innerType.options
      : Object.values(entries ?? {});
    return {
      type: 'enum',
      values,
      default:
        defaultValue ??
        (isOptional || !values || values.length === 0 ? undefined : values[0]),
    };
  }

  // 数组类型
  if (def?.type === 'array') {
    return {
      type: 'array',
      default: defaultValue ?? (isOptional ? undefined : []),
      separator: ',',
    };
  }

  // 默认为字符串
  return {
    type: 'string',
    default: defaultValue ?? (isOptional ? undefined : ''),
  };
}

/**
 * 从简化配置对象提取参数配置
 */
function extractFromConfigObject<T extends Record<string, any>>(
  schema: Record<keyof T, ParamConfig>
): Record<keyof T, ParamConfig> {
  return schema;
}

/**
 * 解析Schema为统一的参数配置
 */
export function parseSchema<T extends Record<string, any>>(
  schema: ParamSchema<T>
): Record<keyof T, ParamConfig> {
  if (isZodSchema(schema)) {
    return extractFromZodSchema<T>(schema);
  }
  return extractFromConfigObject<T>(schema);
}

/**
 * 从URLSearchParams解析参数值
 */
export function parseFromUrl<T extends Record<string, any>>(
  searchParams: URLSearchParams,
  configs: Record<keyof T, ParamConfig>
): T {
  const result: any = {};

  for (const key in configs) {
    const config = configs[key];
    const rawValue = searchParams.get(key as string);

    if (rawValue === null) {
      // 参数不存在,使用默认值
      result[key] = config.default;
      continue;
    }

    // 根据类型转换值
    result[key] = parseValue(rawValue, config);
  }

  return result as T;
}

/**
 * 根据配置解析单个参数值
 */
function parseValue(value: string, config: ParamConfig): any {
  switch (config.type) {
    case 'string':
      return value;

    case 'number': {
      const num = Number(value);
      if (Number.isNaN(num)) {
        return config.default;
      }
      // 应用min/max限制
      if (config.min !== undefined && num < config.min) {
        return config.min;
      }
      if (config.max !== undefined && num > config.max) {
        return config.max;
      }
      return num;
    }

    case 'boolean':
      return value === 'true' || value === '1';

    case 'enum':
      // 验证是否为有效的枚举值
      if (config.values?.includes(value)) {
        return value;
      }
      return config.default;

    case 'array': {
      const separator = config.separator || ',';
      return value.split(separator).filter(v => v.length > 0);
    }

    default:
      return value;
  }
}

/**
 * 验证参数值
 */
export function validateParams<T extends Record<string, any>>(
  params: T,
  schema: ParamSchema<T>
): ValidationResult<T> {
  // 如果是Zod schema,使用Zod验证
  if (isZodSchema(schema)) {
    try {
      const result = schema.safeParse(params);
      if (result.success) {
        return {
          success: true,
          data: result.data as T,
        };
      }

      const firstError = result.error?.issues?.[0];
      return {
        success: false,
        error: firstError
          ? `${firstError.path?.join('.')}: ${firstError.message}`
          : '参数验证失败',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  // 简化配置的基本验证
  const configs = extractFromConfigObject<T>(schema);

  for (const key in params) {
    const config = configs[key];
    const value = params[key];

    if (!config) continue;

    // 类型检查
    if (config.type === 'number' && typeof value !== 'number') {
      return {
        success: false,
        error: `${key}: 期望数字类型,得到 ${typeof value}`,
      };
    }

    if (config.type === 'boolean' && typeof value !== 'boolean') {
      return {
        success: false,
        error: `${key}: 期望布尔类型,得到 ${typeof value}`,
      };
    }

    // 枚举值检查
    if (
      config.type === 'enum' &&
      value !== undefined &&
      !config.values?.includes(value)
    ) {
      return {
        success: false,
        error: `${key}: 无效的枚举值 "${value}", 有效值: ${config.values?.join(', ')}`,
      };
    }

    // 数字范围检查
    if (config.type === 'number' && typeof value === 'number') {
      if (config.min !== undefined && value < config.min) {
        return {
          success: false,
          error: `${key}: 值 ${value} 小于最小值 ${config.min}`,
        };
      }
      if (config.max !== undefined && value > config.max) {
        return {
          success: false,
          error: `${key}: 值 ${value} 大于最大值 ${config.max}`,
        };
      }
    }
  }

  return {
    success: true,
    data: params,
  };
}

/**
 * 获取默认参数值
 */
export function getDefaultParams<T extends Record<string, any>>(
  configs: Record<keyof T, ParamConfig>
): T {
  const result: any = {};

  for (const key in configs) {
    result[key] = configs[key].default;
  }

  return result as T;
}

/**
 * URL Search Params Hook - 类型定义
 *
 * 提供类型安全的URL参数管理
 * 遵循React和Next.js最佳实践
 */

import type { z } from 'zod';

/**
 * 参数类型
 */
export type ParamType = 'string' | 'number' | 'boolean' | 'enum' | 'array';

/**
 * 参数配置(简化版)
 */
export interface ParamConfig<T = unknown> {
  /** 参数类型 */
  type: ParamType;
  /** 默认值 */
  default?: T;
  /** 枚举值(当type为enum时) */
  values?: readonly T[];
  /** 最小值(当type为number时) */
  min?: number;
  /** 最大值(当type为number时) */
  max?: number;
  /** 数组分隔符(当type为array时) */
  separator?: string;
}

/**
 * Schema配置 - 支持两种形式
 * 1. Zod Schema (推荐)
 * 2. 简化配置对象
 */
export type ParamSchema<T extends object> =
  | z.ZodObject<z.ZodRawShape>
  | Record<keyof T, ParamConfig>;

/**
 * Hook选项
 */
export interface UseUrlSearchParamsOptions<
  T extends object = Record<string, unknown>,
> {
  /** 基础路径(用于构建完整URL) */
  basePath?: string;
  /** 防抖延迟(毫秒) */
  debounceMs?: number;
  /** 是否使用浅路由(不重新加载数据) */
  shallow?: boolean;
  /** 初始参数(来自服务端) */
  initialParams?: Partial<T>;
}

/**
 * Hook返回值
 */
export interface UseUrlSearchParamsResult<T extends object> {
  /** 当前参数值(类型安全) */
  params: T;

  /** 更新单个参数 */
  setParam: <K extends keyof T>(key: K, value: T[K] | undefined) => void;

  /** 批量更新参数 */
  updateParams: (updates: Partial<T>) => void;

  /** 重置所有参数到默认值 */
  resetParams: () => void;

  /** 构建查询字符串 */
  buildQueryString: (overrides?: Partial<T>) => string;

  /** 是否正在更新URL */
  isPending: boolean;
}

/**
 * 序列化选项
 */
export interface SerializeOptions {
  /** 是否包含默认值 */
  includeDefaults?: boolean;
  /** 是否编码URI */
  encodeUri?: boolean;
}

/**
 * 参数验证结果
 */
export interface ValidationResult<T> {
  /** 是否验证成功 */
  success: boolean;
  /** 验证后的数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
}

/**
 * 安全的 JSON 解析工具
 *
 * 提供带错误处理的 JSON 解析函数，防止因 JSON 格式错误导致系统崩溃
 *
 * @example
 * ```ts
 * // 基本用法
 * const data = safeJSONParse(jsonString, null);
 *
 * // 带类型和日志
 * const config = safeJSONParse<Config>(
 *   jsonString,
 *   defaultConfig,
 *   { logError: true, context: 'config-parse' }
 * );
 *
 * // 带验证
 * const validated = safeJSONParseWithValidation(
 *   jsonString,
 *   configSchema,
 *   defaultConfig
 * );
 * ```
 */

import type { ZodSchema } from 'zod';

import { logger } from '@/lib/logger';

/**
 * 安全 JSON 解析选项
 */
export interface SafeJSONParseOptions {
  /**
   * 是否记录错误日志
   * @default false
   */
  logError?: boolean;

  /**
   * 日志上下文（模块名称）
   * @default 'safe-json-parse'
   */
  context?: string;

  /**
   * 是否在日志中包含原始 JSON 字符串（截断）
   * @default true
   */
  includeRawJSON?: boolean;

  /**
   * 日志中 JSON 字符串的最大长度
   * @default 100
   */
  maxJSONLength?: number;
}

/**
 * 安全地解析 JSON 字符串
 *
 * 如果解析失败，返回默认值而不是抛出异常
 *
 * @param json - 要解析的 JSON 字符串
 * @param defaultValue - 解析失败时返回的默认值
 * @param options - 解析选项
 * @returns 解析后的对象或默认值
 *
 * @example
 * ```ts
 * const data = safeJSONParse('{"name":"test"}', null);
 * // 成功: { name: 'test' }
 *
 * const data = safeJSONParse('invalid json', null);
 * // 失败: null
 *
 * const data = safeJSONParse('invalid', {}, {
 *   logError: true,
 *   context: 'user-settings'
 * });
 * // 失败: {} (并记录错误日志)
 * ```
 */
export function safeJSONParse<T>(
  json: string,
  defaultValue: T,
  options?: SafeJSONParseOptions
): T {
  const {
    logError = false,
    context = 'safe-json-parse',
    includeRawJSON = true,
    maxJSONLength = 100,
  } = options || {};

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    if (logError) {
      const metadata: Record<string, unknown> = {};

      if (includeRawJSON) {
        // 只记录前 N 个字符，避免日志过大
        metadata.rawJSON =
          json.length > maxJSONLength
            ? `${json.substring(0, maxJSONLength)}... (truncated)`
            : json;
        metadata.jsonLength = json.length;
      }

      logger.error(
        context,
        'Failed to parse JSON string',
        error,
        undefined,
        metadata
      );
    }

    return defaultValue;
  }
}

/**
 * 安全地解析 JSON 字符串并验证类型
 *
 * 使用 Zod schema 验证解析后的数据，确保类型安全
 *
 * @param json - 要解析的 JSON 字符串
 * @param schema - Zod 验证 schema
 * @param defaultValue - 解析或验证失败时返回的默认值
 * @param options - 解析选项
 * @returns 验证后的对象或默认值
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const userSchema = z.object({
 *   name: z.string(),
 *   age: z.number(),
 * });
 *
 * const user = safeJSONParseWithValidation(
 *   '{"name":"Alice","age":30}',
 *   userSchema,
 *   null,
 *   { logError: true, context: 'user-data' }
 * );
 * // 成功: { name: 'Alice', age: 30 }
 *
 * const invalid = safeJSONParseWithValidation(
 *   '{"name":"Bob"}', // 缺少 age
 *   userSchema,
 *   null
 * );
 * // 失败: null
 * ```
 */
export function safeJSONParseWithValidation<T>(
  json: string,
  schema: ZodSchema<T>,
  defaultValue: T,
  options?: SafeJSONParseOptions
): T {
  const {
    logError = false,
    context = 'safe-json-parse-validation',
    includeRawJSON = true,
    maxJSONLength = 100,
  } = options || {};

  try {
    const parsed = JSON.parse(json);
    const validated = schema.parse(parsed);
    return validated;
  } catch (error) {
    if (logError) {
      const metadata: Record<string, unknown> = {};

      if (includeRawJSON) {
        metadata.rawJSON =
          json.length > maxJSONLength
            ? `${json.substring(0, maxJSONLength)}... (truncated)`
            : json;
        metadata.jsonLength = json.length;
      }

      // 区分 JSON 解析错误和 Zod 验证错误
      if (error instanceof SyntaxError) {
        metadata.errorType = 'JSON_PARSE_ERROR';
      } else {
        metadata.errorType = 'VALIDATION_ERROR';
      }

      logger.error(
        context,
        'Failed to parse and validate JSON string',
        error,
        undefined,
        metadata
      );
    }

    return defaultValue;
  }
}

/**
 * 尝试解析 JSON，返回 Result 类型
 *
 * 不使用默认值，而是返回成功/失败的结果对象
 *
 * @param json - 要解析的 JSON 字符串
 * @returns 包含成功或失败信息的结果对象
 *
 * @example
 * ```ts
 * const result = tryParseJSON('{"name":"test"}');
 * if (result.success) {
 *   console.log(result.data); // { name: 'test' }
 * } else {
 *   console.error(result.error); // Error object
 * }
 * ```
 */
export function tryParseJSON<T = unknown>(
  json: string
): { success: true; data: T } | { success: false; error: Error } {
  try {
    const data = JSON.parse(json) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * 检查字符串是否为有效的 JSON
 *
 * @param json - 要检查的字符串
 * @returns 是否为有效的 JSON
 *
 * @example
 * ```ts
 * isValidJSON('{"name":"test"}'); // true
 * isValidJSON('invalid json'); // false
 * isValidJSON('null'); // true
 * isValidJSON('123'); // true
 * ```
 */
export function isValidJSON(json: string): boolean {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * 安全地字符串化对象为 JSON
 *
 * 处理循环引用和 BigInt 等特殊情况
 *
 * @param value - 要字符串化的值
 * @param defaultValue - 失败时返回的默认值
 * @param options - 字符串化选项
 * @returns JSON 字符串或默认值
 *
 * @example
 * ```ts
 * const json = safeJSONStringify({ name: 'test' }, '{}');
 * // 成功: '{"name":"test"}'
 *
 * const circular = { a: {} };
 * circular.a = circular; // 循环引用
 * const json = safeJSONStringify(circular, '{}', { logError: true });
 * // 失败: '{}' (并记录错误)
 * ```
 */
export function safeJSONStringify(
  value: unknown,
  defaultValue: string = '{}',
  options?: SafeJSONParseOptions
): string {
  const { logError = false, context = 'safe-json-stringify' } = options || {};

  try {
    return JSON.stringify(value);
  } catch (error) {
    if (logError) {
      logger.error(
        context,
        'Failed to stringify value to JSON',
        error,
        undefined,
        {
          valueType: typeof value,
        }
      );
    }

    return defaultValue;
  }
}

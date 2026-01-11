/**
 * 统一的验证中间件
 *
 * 功能:
 * 1. 统一处理 Zod 验证错误
 * 2. 提供请求体验证中间件
 * 3. 提供查询参数验证中间件
 * 4. 确保类型安全
 *
 * 使用示例:
 * ```typescript
 * import { withBodyValidation } from '@/lib/api/validation-middleware';
 * import { productCreateSchema } from '@/lib/validations/product';
 *
 * export const POST = withBodyValidation(
 *   productCreateSchema,
 *   async (request, validatedData) => {
 *     // validatedData 已验证,类型安全
 *     const product = await prisma.product.create({ data: validatedData });
 *     return NextResponse.json({ success: true, data: product });
 *   }
 * );
 * ```
 */

import { type NextRequest, NextResponse } from 'next/server';
import { type ZodSchema, ZodError } from 'zod';

/**
 * 验证错误详情
 */
export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * 验证错误响应
 */
export interface ValidationErrorResponse {
  success: false;
  error: string;
  details: ValidationErrorDetail[];
}

/**
 * 统一的 Zod 验证错误处理
 *
 * @param error - Zod 验证错误
 * @returns 格式化的错误响应
 */
export function handleValidationError(
  error: ZodError
): NextResponse<ValidationErrorResponse> {
  const errors: ValidationErrorDetail[] = error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));

  const firstIssue = error.issues[0];
  const message = firstIssue
    ? firstIssue.path.length > 0
      ? `${firstIssue.path.join('.')}: ${firstIssue.message}`
      : firstIssue.message
    : '数据验证失败';

  return NextResponse.json(
    {
      success: false,
      error: message,
      details: errors,
    },
    { status: 400 }
  );
}

/**
 * 请求处理器类型(带验证数据)
 */
export type ValidatedHandler<T, TContext = unknown> = (
  request: NextRequest,
  validatedData: T,
  context?: TContext
) => Promise<Response>;

/**
 * 验证请求体的中间件工厂函数
 *
 * @param schema - Zod 验证 Schema
 * @param handler - 请求处理器
 * @returns 包装后的请求处理器
 *
 * @example
 * ```typescript
 * export const POST = withBodyValidation(
 *   productCreateSchema,
 *   async (request, validatedData) => {
 *     const product = await createProduct(validatedData);
 *     return NextResponse.json({ success: true, data: product });
 *   }
 * );
 * ```
 */
export function withBodyValidation<T>(
  schema: ZodSchema<T>,
  handler: ValidatedHandler<T>
) {
  return async (request: NextRequest, context?: unknown): Promise<Response> => {
    try {
      // 解析请求体
      const body = await request.json();

      // 验证数据
      const validatedData = schema.parse(body);

      // 调用处理器
      return await handler(request, validatedData, context);
    } catch (error) {
      // 处理验证错误
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }

      // 其他错误继续抛出
      throw error;
    }
  };
}

/**
 * 查询参数处理器类型
 */
export type QueryValidatedHandler<T, TContext = unknown> = (
  request: NextRequest,
  validatedQuery: T,
  context?: TContext
) => Promise<Response>;

/**
 * 验证查询参数的中间件工厂函数
 *
 * @param schema - Zod 验证 Schema
 * @param handler - 请求处理器
 * @returns 包装后的请求处理器
 *
 * @example
 * ```typescript
 * export const GET = withQueryValidation(
 *   productQuerySchema,
 *   async (request, validatedQuery) => {
 *     const products = await getProducts(validatedQuery);
 *     return NextResponse.json({ success: true, data: products });
 *   }
 * );
 * ```
 */
export function withQueryValidation<T>(
  schema: ZodSchema<T>,
  handler: QueryValidatedHandler<T>
) {
  return async (request: NextRequest, context?: unknown): Promise<Response> => {
    try {
      // 解析查询参数
      const { searchParams } = new URL(request.url);

      // 将 URLSearchParams 转换为普通对象
      const query: Record<string, string | number> = {};
      searchParams.forEach((value, key) => {
        // 尝试将数字字符串转换为数字
        if (/^\d+$/.test(value)) {
          query[key] = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          query[key] = parseFloat(value);
        } else {
          query[key] = value;
        }
      });

      // 验证数据
      const validatedQuery = schema.parse(query);

      // 调用处理器
      return await handler(request, validatedQuery, context);
    } catch (error) {
      // 处理验证错误
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }

      // 其他错误继续抛出
      throw error;
    }
  };
}

/**
 * 组合验证中间件
 * 同时验证请求体和查询参数
 *
 * @param bodySchema - 请求体验证 Schema
 * @param querySchema - 查询参数验证 Schema
 * @param handler - 请求处理器
 * @returns 包装后的请求处理器
 *
 * @example
 * ```typescript
 * export const POST = withCombinedValidation(
 *   productCreateSchema,
 *   productQuerySchema,
 *   async (request, validatedBody, validatedQuery) => {
 *     // 同时使用验证后的请求体和查询参数
 *     const product = await createProduct(validatedBody, validatedQuery);
 *     return NextResponse.json({ success: true, data: product });
 *   }
 * );
 * ```
 */
export function withCombinedValidation<TBody, TQuery>(
  bodySchema: ZodSchema<TBody>,
  querySchema: ZodSchema<TQuery>,
  handler: (
    request: NextRequest,
    validatedBody: TBody,
    validatedQuery: TQuery,
    context?: unknown
  ) => Promise<Response>
) {
  return async (request: NextRequest, context?: unknown): Promise<Response> => {
    try {
      // 解析并验证请求体
      const body = await request.json();
      const validatedBody = bodySchema.parse(body);

      // 解析并验证查询参数
      const { searchParams } = new URL(request.url);
      const query: Record<string, string | number> = {};
      searchParams.forEach((value, key) => {
        if (/^\d+$/.test(value)) {
          query[key] = parseInt(value, 10);
        } else if (/^\d+\.\d+$/.test(value)) {
          query[key] = parseFloat(value);
        } else {
          query[key] = value;
        }
      });
      const validatedQuery = querySchema.parse(query);

      // 调用处理器
      return await handler(request, validatedBody, validatedQuery, context);
    } catch (error) {
      // 处理验证错误
      if (error instanceof ZodError) {
        return handleValidationError(error);
      }

      // 其他错误继续抛出
      throw error;
    }
  };
}

/**
 * 安全解析(不抛出错误)
 *
 * @param schema - Zod 验证 Schema
 * @param data - 待验证数据
 * @returns 验证结果
 *
 * @example
 * ```typescript
 * const result = safeParse(productCreateSchema, body);
 * if (result.success) {
 *   // 使用 result.data
 * } else {
 *   // 处理 result.error
 * }
 * ```
 */
export function safeParse<T>(
  schema: ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * 格式化验证错误为用户友好的消息
 *
 * @param error - Zod 验证错误
 * @returns 格式化的错误消息
 */
export function formatValidationError(error: ZodError): string {
  const messages = error.issues.map(err => {
    const field = err.path.join('.');
    return field ? `${field}: ${err.message}` : err.message;
  });

  return messages.join('; ');
}

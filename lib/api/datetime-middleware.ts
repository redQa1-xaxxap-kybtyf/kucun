/**
 * API响应时间格式转换中间件
 * 统一处理API响应中的时间字段格式
 */

import { NextResponse, type NextRequest } from 'next/server';

import { DateTimeTransformer } from '@/lib/utils/datetime';

/**
 * API处理器类型定义
 */
export type ApiHandler = (
  request: NextRequest,
  ...args: unknown[]
) => Promise<Response>;

/**
 * 时间字段转换配置
 */
export interface DateTimeTransformConfig {
  // 需要转换的时间字段名称
  timeFields?: string[];
  // 是否启用深度转换（处理嵌套对象）
  deepTransform?: boolean;
  // 是否转换数组中的对象
  transformArrays?: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<DateTimeTransformConfig> = {
  timeFields: [
    'createdAt',
    'updatedAt',
    'deletedAt',
    'publishedAt',
    'expiredAt',
    'dueDate',
    'paymentDate',
    'productionDate',
  ],
  deepTransform: true,
  transformArrays: true,
};

/**
 * 时间格式转换中间件
 * 自动将API响应中的Date对象转换为ISO字符串
 */
export function withDateTimeTransform(
  handler: ApiHandler,
  config: DateTimeTransformConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  return async (
    request: NextRequest,
    ...args: unknown[]
  ): Promise<Response> => {
    try {
      // 执行原始处理器
      const response = await handler(request, ...args);

      // 只处理JSON响应
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return response;
      }

      // 获取响应数据
      const responseData = await response.json();

      // 转换时间字段
      const transformedData = transformResponseData(responseData, finalConfig);

      // 创建新的响应
      return NextResponse.json(transformedData, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      // 如果转换失败，返回原始响应
       
      console.error('DateTime transform middleware error:', error);
      return handler(request, ...args);
    }
  };
}

/**
 * 转换响应数据中的时间字段
 */
function transformResponseData(
  data: unknown,
  config: Required<DateTimeTransformConfig>
): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // 处理标准API响应格式 { success, data, error, message }
  if (isApiResponse(data)) {
    return {
      ...data,
      data: data.data ? transformTimeFields(data.data, config) : data.data,
    };
  }

  // 直接转换数据
  return transformTimeFields(data, config);
}

/**
 * 检查是否为标准API响应格式
 */
function isApiResponse(data: unknown): data is {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    'success' in data &&
    typeof (data as { success: unknown }).success === 'boolean'
  );
}

/**
 * 转换时间字段
 */
function transformTimeFields(
  data: unknown,
  config: Required<DateTimeTransformConfig>
): unknown {
  if (config.deepTransform) {
    return DateTimeTransformer.transformNested(data, config.timeFields);
  }

  if (Array.isArray(data) && config.transformArrays) {
    return DateTimeTransformer.transformArray(
      data as Record<string, unknown>[],
      config.timeFields
    );
  }

  if (typeof data === 'object' && data !== null) {
    return DateTimeTransformer.transformObject(
      data as Record<string, unknown>,
      config.timeFields
    );
  }

  return data;
}

/**
 * 专门用于产品API的时间转换中间件
 */
export function withProductDateTimeTransform(handler: ApiHandler) {
  return withDateTimeTransform(handler, {
    timeFields: ['createdAt', 'updatedAt', 'productionDate'],
    deepTransform: true,
    transformArrays: true,
  });
}

/**
 * 专门用于订单API的时间转换中间件
 */
export function withOrderDateTimeTransform(handler: ApiHandler) {
  return withDateTimeTransform(handler, {
    timeFields: [
      'createdAt',
      'updatedAt',
      'orderDate',
      'shippedDate',
      'deliveredDate',
    ],
    deepTransform: true,
    transformArrays: true,
  });
}

/**
 * 专门用于库存API的时间转换中间件
 */
export function withInventoryDateTimeTransform(handler: ApiHandler) {
  return withDateTimeTransform(handler, {
    timeFields: ['createdAt', 'updatedAt', 'productionDate', 'expiryDate'],
    deepTransform: true,
    transformArrays: true,
  });
}

/**
 * 专门用于支付API的时间转换中间件
 */
export function withPaymentDateTimeTransform(handler: ApiHandler) {
  return withDateTimeTransform(handler, {
    timeFields: ['createdAt', 'updatedAt', 'paymentDate', 'dueDate'],
    deepTransform: true,
    transformArrays: true,
  });
}

/**
 * 手动转换单个对象的时间字段
 * 用于在处理器内部手动转换数据
 */
export function transformObjectDateTime<T extends Record<string, unknown>>(
  obj: T,
  timeFields?: string[]
): T {
  return DateTimeTransformer.transformObject(
    obj,
    timeFields || DEFAULT_CONFIG.timeFields
  );
}

/**
 * 手动转换数组对象的时间字段
 */
export function transformArrayDateTime<T extends Record<string, unknown>>(
  array: T[],
  timeFields?: string[]
): T[] {
  return DateTimeTransformer.transformArray(
    array,
    timeFields || DEFAULT_CONFIG.timeFields
  );
}

/**
 * 创建带时间转换的成功响应
 */
export function createDateTimeResponse<T>(
  data: T,
  status: number = 200,
  message?: string,
  timeFields?: string[]
): NextResponse {
  const transformedData = timeFields
    ? DateTimeTransformer.transformNested(data, timeFields)
    : DateTimeTransformer.transformNested(data, DEFAULT_CONFIG.timeFields);

  const response = {
    success: true,
    data: transformedData,
    ...(message && { message }),
  };

  return NextResponse.json(response, { status });
}
